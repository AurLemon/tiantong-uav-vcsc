use axum::{extract::Path, extract::Query, Json};
use loco_rs::prelude::*;
use sea_orm::{entity::prelude::*, QueryOrder, QuerySelect, Set};
use serde::{Deserialize, Serialize};

use crate::controllers::common::{manual_paginate, PaginatedResponse, PaginationParams};
use crate::models::{element_type, prediction};

#[derive(Debug, Deserialize)]
pub struct CreatePredictionRequest {
    pub region: Option<String>,
    pub tid: Option<i32>,
    pub v: Option<f64>,
    pub tm: Option<String>, // ISO 8601 format
}

#[derive(Debug, Deserialize)]
pub struct UpdatePredictionRequest {
    pub region: Option<String>,
    pub tid: Option<i32>,
    pub v: Option<f64>,
    pub tm: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PredictionQueryParams {
    #[serde(flatten)]
    pub pagination: PaginationParams,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub tid: Option<i32>,
    #[serde(default)]
    pub start_time: Option<String>,
    #[serde(default)]
    pub end_time: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PredictionResponse {
    pub id: i64,
    pub region: Option<String>,
    pub tid: Option<i32>,
    pub element_type_name: Option<String>,
    pub v: Option<String>,
    pub tm: Option<String>,
}

impl From<(prediction::Model, Option<element_type::Model>)> for PredictionResponse {
    fn from((prediction, element_type): (prediction::Model, Option<element_type::Model>)) -> Self {
        Self {
            id: prediction.id,
            region: prediction.region,
            tid: prediction.tid,
            element_type_name: element_type.map(|et| et.name),
            v: prediction.v.map(|v| v.to_string()),
            tm: prediction
                .tm
                .map(|tm| tm.format("%Y-%m-%d %H:%M:%S").to_string()),
        }
    }
}

/// 获取预报数据列表（分页）
pub async fn list(
    State(ctx): State<AppContext>,
    Query(mut params): Query<PredictionQueryParams>,
) -> Result<Json<PaginatedResponse<PredictionResponse>>> {
    params.pagination.validate();

    let db = &ctx.db;

    let mut query = prediction::Entity::find();

    // 添加过滤条件
    if let Some(region) = &params.region {
        query = query.filter(prediction::Column::Region.eq(region));
    }
    if let Some(tid) = params.tid {
        query = query.filter(prediction::Column::Tid.eq(tid));
    }
    if let Some(start_time) = &params.start_time {
        if let Ok(start_dt) = chrono::DateTime::parse_from_rfc3339(start_time) {
            query = query
                .filter(prediction::Column::Tm.gte(
                    start_dt.with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap()),
                ));
        }
    }
    if let Some(end_time) = &params.end_time {
        if let Ok(end_dt) = chrono::DateTime::parse_from_rfc3339(end_time) {
            query = query.filter(
                prediction::Column::Tm
                    .lte(end_dt.with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap())),
            );
        }
    }

    // 获取总数
    let total_count = query.clone().count(db).await?;

    // 获取分页数据
    let predictions = query
        .order_by_desc(prediction::Column::Tm)
        .offset(params.pagination.offset())
        .limit(params.pagination.page_size)
        .all(db)
        .await?;

    let mut response_data = Vec::new();
    for prediction in predictions {
        let element_type = if let Some(tid) = prediction.tid {
            element_type::Entity::find_by_id(tid).one(db).await?
        } else {
            None
        };
        response_data.push(PredictionResponse::from((prediction, element_type)));
    }

    let paginated_response = manual_paginate(total_count, response_data, &params.pagination);

    Ok(Json(paginated_response))
}

/// 根据ID获取预报数据详情
pub async fn get_by_id(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Json<PredictionResponse>> {
    let db = &ctx.db;

    let prediction = prediction::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    let element_type = if let Some(tid) = prediction.tid {
        element_type::Entity::find_by_id(tid).one(db).await?
    } else {
        None
    };

    Ok(Json(PredictionResponse::from((prediction, element_type))))
}

/// 创建预报数据
pub async fn create(
    State(ctx): State<AppContext>,
    Json(req): Json<CreatePredictionRequest>,
) -> Result<Json<PredictionResponse>> {
    let db = &ctx.db;

    // 解析时间
    let tm = if let Some(time_str) = req.tm {
        Some(
            chrono::DateTime::parse_from_rfc3339(&time_str)
                .map_err(|_| Error::string("Invalid tm format"))?
                .with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap()),
        )
    } else {
        None
    };

    let new_prediction = prediction::ActiveModel {
        region: Set(req.region),
        tid: Set(req.tid),
        v: Set(req.v.map(|v| Decimal::from_f64_retain(v).unwrap())),
        tm: Set(tm),
        ..Default::default()
    };

    let prediction = new_prediction.insert(db).await?;

    // 获取关联数据
    let element_type = if let Some(tid) = prediction.tid {
        element_type::Entity::find_by_id(tid).one(db).await?
    } else {
        None
    };

    Ok(Json(PredictionResponse::from((prediction, element_type))))
}

/// 更新预报数据
pub async fn update(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    Json(req): Json<UpdatePredictionRequest>,
) -> Result<Json<PredictionResponse>> {
    let db = &ctx.db;

    let prediction = prediction::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    let mut active_prediction: prediction::ActiveModel = prediction.into();

    if let Some(region) = req.region {
        active_prediction.region = Set(Some(region));
    }
    if let Some(tid) = req.tid {
        active_prediction.tid = Set(Some(tid));
    }
    if let Some(v) = req.v {
        active_prediction.v = Set(Some(Decimal::from_f64_retain(v).unwrap()));
    }
    if let Some(tm_str) = req.tm {
        let tm = chrono::DateTime::parse_from_rfc3339(&tm_str)
            .map_err(|_| Error::string("Invalid tm format"))?
            .with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap());
        active_prediction.tm = Set(Some(tm));
    }

    let updated_prediction = active_prediction.update(db).await?;

    // 获取关联数据
    let element_type = if let Some(tid) = updated_prediction.tid {
        element_type::Entity::find_by_id(tid).one(db).await?
    } else {
        None
    };

    Ok(Json(PredictionResponse::from((
        updated_prediction,
        element_type,
    ))))
}

/// 删除预报数据
pub async fn delete(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>> {
    let db = &ctx.db;

    let prediction = prediction::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    prediction::Entity::delete_by_id(prediction.id)
        .exec(db)
        .await?;

    Ok(Json(serde_json::json!({
        "message": "Prediction deleted successfully",
        "id": id
    })))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("predictions")
        .add("/", get(list))
        .add("/", post(create))
        .add("/{id}", get(get_by_id))
        .add("/{id}", put(update))
        .add("/{id}", axum::routing::delete(delete))
}
