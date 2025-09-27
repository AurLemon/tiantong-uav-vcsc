use axum::{extract::Path, extract::Query, Json};
use loco_rs::prelude::*;
use sea_orm::{entity::prelude::*, QueryOrder, QuerySelect, Set};
use serde::{Deserialize, Serialize};

use crate::controllers::common::{manual_paginate, PaginatedResponse, PaginationParams};
use crate::models::weather_condition;

#[derive(Debug, Deserialize)]
pub struct CreateWeatherConditionRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWeatherConditionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WeatherConditionResponse {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<weather_condition::Model> for WeatherConditionResponse {
    fn from(model: weather_condition::Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
            description: model.description,
            created_at: model.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: model.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        }
    }
}

/// 获取天气情况列表（分页）
pub async fn list(
    State(ctx): State<AppContext>,
    Query(mut params): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<WeatherConditionResponse>>> {
    params.validate();

    let db = &ctx.db;

    // 获取总数
    let total_count = weather_condition::Entity::find().count(db).await?;

    // 获取分页数据
    let weather_conditions = weather_condition::Entity::find()
        .order_by_asc(weather_condition::Column::Id)
        .offset(params.offset())
        .limit(params.page_size)
        .all(db)
        .await?;

    let response_data: Vec<WeatherConditionResponse> = weather_conditions
        .into_iter()
        .map(WeatherConditionResponse::from)
        .collect();

    let paginated_response = manual_paginate(total_count, response_data, &params);

    Ok(Json(paginated_response))
}

/// 获取所有天气情况（不分页，用于下拉选择）
pub async fn list_all(
    State(ctx): State<AppContext>,
) -> Result<Json<Vec<WeatherConditionResponse>>> {
    let db = &ctx.db;

    let weather_conditions = weather_condition::Entity::find()
        .order_by_asc(weather_condition::Column::Id)
        .all(db)
        .await?;

    let response_data: Vec<WeatherConditionResponse> = weather_conditions
        .into_iter()
        .map(WeatherConditionResponse::from)
        .collect();

    Ok(Json(response_data))
}

/// 根据ID获取天气情况详情
pub async fn get_by_id(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
) -> Result<Json<WeatherConditionResponse>> {
    let db = &ctx.db;

    let weather_condition = weather_condition::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    Ok(Json(WeatherConditionResponse::from(weather_condition)))
}

/// 创建天气情况
pub async fn create(
    State(ctx): State<AppContext>,
    Json(req): Json<CreateWeatherConditionRequest>,
) -> Result<Json<WeatherConditionResponse>> {
    let db = &ctx.db;

    let new_weather_condition = weather_condition::ActiveModel {
        name: Set(req.name),
        description: Set(req.description),
        ..Default::default()
    };

    let weather_condition = new_weather_condition.insert(db).await?;

    Ok(Json(WeatherConditionResponse::from(weather_condition)))
}

/// 更新天气情况
pub async fn update(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateWeatherConditionRequest>,
) -> Result<Json<WeatherConditionResponse>> {
    let db = &ctx.db;

    let weather_condition = weather_condition::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    let mut active_weather_condition: weather_condition::ActiveModel = weather_condition.into();

    if let Some(name) = req.name {
        active_weather_condition.name = Set(name);
    }
    if let Some(description) = req.description {
        active_weather_condition.description = Set(Some(description));
    }

    let updated_weather_condition = active_weather_condition.update(db).await?;

    Ok(Json(WeatherConditionResponse::from(
        updated_weather_condition,
    )))
}

/// 删除天气情况
pub async fn delete(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
) -> Result<Json<serde_json::Value>> {
    let db = &ctx.db;

    let weather_condition = weather_condition::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    weather_condition::Entity::delete_by_id(weather_condition.id)
        .exec(db)
        .await?;

    Ok(Json(serde_json::json!({
        "message": "Weather condition deleted successfully",
        "id": id
    })))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("weather-conditions")
        .add("/", get(list))
        .add("/all", get(list_all))
        .add("/", post(create))
        .add("/{id}", get(get_by_id))
        .add("/{id}", put(update))
        .add("/{id}", axum::routing::delete(delete))
}
