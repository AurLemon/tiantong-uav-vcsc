use axum::{extract::Path, extract::Query, Json};
use loco_rs::prelude::*;
use sea_orm::{entity::prelude::*, QueryOrder, QuerySelect, Set};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::controllers::common::{manual_paginate, PaginatedResponse, PaginationParams};
use crate::models::warn;

#[derive(Debug, Deserialize)]
pub struct CreateWarnRequest {
    pub content: JsonValue,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWarnRequest {
    pub content: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct WarnQueryParams {
    #[serde(flatten)]
    pub pagination: PaginationParams,
}

#[derive(Debug, Serialize)]
pub struct WarnResponse {
    pub id: i32,
    pub content: Option<JsonValue>,
}

impl From<warn::Model> for WarnResponse {
    fn from(model: warn::Model) -> Self {
        Self {
            id: model.id,
            content: model.content,
        }
    }
}

/// 获取风险个例列表（分页）
pub async fn list(
    State(ctx): State<AppContext>,
    Query(mut params): Query<WarnQueryParams>,
) -> Result<Json<PaginatedResponse<WarnResponse>>> {
    params.pagination.validate();

    let db = &ctx.db;

    // 获取总数
    let total_count = warn::Entity::find().count(db).await?;

    // 获取分页数据
    let warns = warn::Entity::find()
        .order_by_desc(warn::Column::Id)
        .offset(params.pagination.offset())
        .limit(params.pagination.page_size)
        .all(db)
        .await?;

    let response_data: Vec<WarnResponse> = warns.into_iter().map(WarnResponse::from).collect();

    let paginated_response = manual_paginate(total_count, response_data, &params.pagination);

    Ok(Json(paginated_response))
}

/// 根据ID获取风险个例详情
pub async fn get_by_id(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
) -> Result<Json<WarnResponse>> {
    let db = &ctx.db;

    let warn = warn::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    Ok(Json(WarnResponse::from(warn)))
}

/// 创建风险个例
pub async fn create(
    State(ctx): State<AppContext>,
    Json(req): Json<CreateWarnRequest>,
) -> Result<Json<WarnResponse>> {
    let db = &ctx.db;

    let new_warn = warn::ActiveModel {
        content: Set(Some(req.content)),
        ..Default::default()
    };

    let warn = new_warn.insert(db).await?;

    Ok(Json(WarnResponse::from(warn)))
}

/// 更新风险个例
pub async fn update(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateWarnRequest>,
) -> Result<Json<WarnResponse>> {
    let db = &ctx.db;

    let warn = warn::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    let mut active_warn: warn::ActiveModel = warn.into();

    if let Some(content) = req.content {
        active_warn.content = Set(Some(content));
    }

    let updated_warn = active_warn.update(db).await?;

    Ok(Json(WarnResponse::from(updated_warn)))
}

/// 删除风险个例
pub async fn delete(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
) -> Result<Json<serde_json::Value>> {
    let db = &ctx.db;

    let warn = warn::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    warn::Entity::delete_by_id(warn.id).exec(db).await?;

    Ok(Json(serde_json::json!({
        "message": "Warning case deleted successfully",
        "id": id
    })))
}

/// 解析风险个例内容（用于前端展示）
pub async fn parse_content(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
) -> Result<Json<JsonValue>> {
    let db = &ctx.db;

    let warn = warn::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    if let Some(content) = warn.content {
        // 这里可以添加更多的内容解析逻辑
        // 比如提取时间范围、区域信息、警告统计等
        let mut parsed = serde_json::Map::new();

        if let Some(obj) = content.as_object() {
            // 提取年月信息
            if let Some(year_months) = obj.get("yearMonth") {
                parsed.insert("yearMonths".to_string(), year_months.clone());
            }

            // 提取时间范围列表
            if let Some(time_ranges) = obj.get("timeRangeList") {
                parsed.insert("timeRanges".to_string(), time_ranges.clone());
            }

            // 提取时间数据映射
            if let Some(time_data_map) = obj.get("timeDataMap") {
                parsed.insert("timeDataMap".to_string(), time_data_map.clone());
            }

            // 提取时间范围数据映射
            if let Some(time_range_data_map) = obj.get("timeRangeDataMap") {
                parsed.insert("timeRangeDataMap".to_string(), time_range_data_map.clone());
            }
        }

        Ok(Json(JsonValue::Object(parsed)))
    } else {
        Ok(Json(JsonValue::Null))
    }
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("warnings")
        .add("/", get(list))
        .add("/", post(create))
        .add("/{id}", get(get_by_id))
        .add("/{id}/parse", get(parse_content))
        .add("/{id}", put(update))
        .add("/{id}", axum::routing::delete(delete))
}
