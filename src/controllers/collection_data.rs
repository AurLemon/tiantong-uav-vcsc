use axum::{extract::Path, extract::Query, Json};
use loco_rs::prelude::*;
use sea_orm::{entity::prelude::*, QueryOrder, QuerySelect, Set};
use serde::{Deserialize, Serialize};

use crate::controllers::common::{manual_paginate, PaginatedResponse, PaginationParams};
use crate::models::{collection_data, device, weather_condition};

#[derive(Debug, Deserialize)]
pub struct CreateCollectionDataRequest {
    pub longitude: f64,
    pub latitude: f64,
    pub altitude: Option<f64>,
    pub temperature: Option<f64>,
    pub humidity: Option<f64>,
    pub device_id: Option<i32>,
    pub image_url: Option<String>,
    pub weather_condition_id: Option<i32>,
    pub collected_at: Option<String>, // ISO 8601 format
}

#[derive(Debug, Deserialize)]
pub struct UpdateCollectionDataRequest {
    pub longitude: Option<f64>,
    pub latitude: Option<f64>,
    pub altitude: Option<f64>,
    pub temperature: Option<f64>,
    pub humidity: Option<f64>,
    pub device_id: Option<i32>,
    pub image_url: Option<String>,
    pub weather_condition_id: Option<i32>,
    pub collected_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionDataResponse {
    pub id: i64,
    pub longitude: String,
    pub latitude: String,
    pub altitude: Option<String>,
    pub temperature: Option<String>,
    pub humidity: Option<String>,
    pub device_id: Option<i32>,
    pub device_name: Option<String>,
    pub image_url: Option<String>,
    pub weather_condition_id: Option<i32>,
    pub weather_condition_name: Option<String>,
    pub collected_at: String,
    pub created_at: String,
    pub updated_at: String,
}

impl
    From<(
        collection_data::Model,
        Option<device::Model>,
        Option<weather_condition::Model>,
    )> for CollectionDataResponse
{
    fn from(
        (data, device, weather): (
            collection_data::Model,
            Option<device::Model>,
            Option<weather_condition::Model>,
        ),
    ) -> Self {
        Self {
            id: data.id,
            longitude: data.longitude.to_string(),
            latitude: data.latitude.to_string(),
            altitude: data.altitude.map(|a| a.to_string()),
            temperature: data.temperature.map(|t| t.to_string()),
            humidity: data.humidity.map(|h| h.to_string()),
            device_id: data.device_id,
            device_name: device.map(|d| d.name),
            image_url: data.image_url,
            weather_condition_id: data.weather_condition_id,
            weather_condition_name: weather.map(|w| w.name),
            collected_at: data.collected_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            created_at: data.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: data.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        }
    }
}

/// 获取采集数据列表（分页）
pub async fn list(
    State(ctx): State<AppContext>,
    Query(mut params): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<CollectionDataResponse>>> {
    params.validate();

    let db = &ctx.db;

    // 获取总数
    let total_count = collection_data::Entity::find().count(db).await?;

    // 获取分页数据
    let collection_data_list = collection_data::Entity::find()
        .order_by_desc(collection_data::Column::CollectedAt)
        .offset(params.offset())
        .limit(params.page_size)
        .all(db)
        .await?;

    let mut response_data = Vec::new();
    for data in collection_data_list {
        let device = if let Some(device_id) = data.device_id {
            device::Entity::find_by_id(device_id).one(db).await?
        } else {
            None
        };

        let weather = if let Some(weather_id) = data.weather_condition_id {
            weather_condition::Entity::find_by_id(weather_id)
                .one(db)
                .await?
        } else {
            None
        };

        response_data.push(CollectionDataResponse::from((data, device, weather)));
    }

    let paginated_response = manual_paginate(total_count, response_data, &params);

    Ok(Json(paginated_response))
}

/// 根据ID获取采集数据详情
pub async fn get_by_id(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Json<CollectionDataResponse>> {
    let db = &ctx.db;

    let data = collection_data::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    let device = if let Some(device_id) = data.device_id {
        device::Entity::find_by_id(device_id).one(db).await?
    } else {
        None
    };

    let weather = if let Some(weather_id) = data.weather_condition_id {
        weather_condition::Entity::find_by_id(weather_id)
            .one(db)
            .await?
    } else {
        None
    };

    Ok(Json(CollectionDataResponse::from((data, device, weather))))
}

/// 创建采集数据
pub async fn create(
    State(ctx): State<AppContext>,
    Json(req): Json<CreateCollectionDataRequest>,
) -> Result<Json<CollectionDataResponse>> {
    let db = &ctx.db;

    // 解析采集时间
    let collected_at = if let Some(time_str) = req.collected_at {
        chrono::DateTime::parse_from_rfc3339(&time_str)
            .map_err(|_| Error::string("Invalid collected_at format"))?
            .with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap())
    } else {
        chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap())
    };

    let new_data = collection_data::ActiveModel {
        longitude: Set(Decimal::from_f64_retain(req.longitude).unwrap()),
        latitude: Set(Decimal::from_f64_retain(req.latitude).unwrap()),
        altitude: Set(req.altitude.map(|a| Decimal::from_f64_retain(a).unwrap())),
        temperature: Set(req
            .temperature
            .map(|t| Decimal::from_f64_retain(t).unwrap())),
        humidity: Set(req.humidity.map(|h| Decimal::from_f64_retain(h).unwrap())),
        device_id: Set(req.device_id),
        image_url: Set(req.image_url),
        weather_condition_id: Set(req.weather_condition_id),
        collected_at: Set(collected_at),
        ..Default::default()
    };

    let data = new_data.insert(db).await?;

    // 获取关联数据
    let device = if let Some(device_id) = data.device_id {
        device::Entity::find_by_id(device_id).one(db).await?
    } else {
        None
    };

    let weather = if let Some(weather_id) = data.weather_condition_id {
        weather_condition::Entity::find_by_id(weather_id)
            .one(db)
            .await?
    } else {
        None
    };

    Ok(Json(CollectionDataResponse::from((data, device, weather))))
}

/// 更新采集数据
pub async fn update(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
    Json(req): Json<UpdateCollectionDataRequest>,
) -> Result<Json<CollectionDataResponse>> {
    let db = &ctx.db;

    let data = collection_data::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    let mut active_data: collection_data::ActiveModel = data.clone().into();

    if let Some(longitude) = req.longitude {
        active_data.longitude = Set(Decimal::from_f64_retain(longitude).unwrap());
    }
    if let Some(latitude) = req.latitude {
        active_data.latitude = Set(Decimal::from_f64_retain(latitude).unwrap());
    }
    if let Some(altitude) = req.altitude {
        active_data.altitude = Set(Some(Decimal::from_f64_retain(altitude).unwrap()));
    }
    if let Some(temperature) = req.temperature {
        active_data.temperature = Set(Some(Decimal::from_f64_retain(temperature).unwrap()));
    }
    if let Some(humidity) = req.humidity {
        active_data.humidity = Set(Some(Decimal::from_f64_retain(humidity).unwrap()));
    }
    if let Some(device_id) = req.device_id {
        active_data.device_id = Set(Some(device_id));
    }
    if let Some(image_url) = req.image_url {
        active_data.image_url = Set(Some(image_url));
    }
    if let Some(weather_condition_id) = req.weather_condition_id {
        active_data.weather_condition_id = Set(Some(weather_condition_id));
    }
    if let Some(collected_at_str) = req.collected_at {
        let collected_at = chrono::DateTime::parse_from_rfc3339(&collected_at_str)
            .map_err(|_| Error::string("Invalid collected_at format"))?
            .with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap());
        active_data.collected_at = Set(collected_at);
    }

    let updated_data = active_data.update(db).await?;

    // 获取关联数据
    let device = if let Some(device_id) = updated_data.device_id {
        device::Entity::find_by_id(device_id).one(db).await?
    } else {
        None
    };

    let weather = if let Some(weather_id) = updated_data.weather_condition_id {
        weather_condition::Entity::find_by_id(weather_id)
            .one(db)
            .await?
    } else {
        None
    };

    Ok(Json(CollectionDataResponse::from((data, device, weather))))
}

/// 删除采集数据
pub async fn delete(
    State(ctx): State<AppContext>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>> {
    let db = &ctx.db;

    let data = collection_data::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    collection_data::Entity::delete_by_id(data.id)
        .exec(db)
        .await?;

    Ok(Json(serde_json::json!({
        "message": "Collection data deleted successfully",
        "id": id
    })))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("collection-data")
        .add("/", get(list))
        .add("/", post(create))
        .add("/{id}", get(get_by_id))
        .add("/{id}", put(update))
        .add("/{id}", axum::routing::delete(delete))
}
