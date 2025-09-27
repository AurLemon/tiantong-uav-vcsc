use axum::{extract::Path, extract::Query, Json};
use loco_rs::prelude::*;
use sea_orm::{entity::prelude::*, QueryOrder, QuerySelect, Set};
use serde::{Deserialize, Serialize};

use crate::controllers::common::{manual_paginate, PaginatedResponse, PaginationParams};
use crate::models::element_type;

#[derive(Debug, Deserialize)]
pub struct CreateElementTypeRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateElementTypeRequest {
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ElementTypeResponse {
    pub id: i32,
    pub name: String,
}

impl From<element_type::Model> for ElementTypeResponse {
    fn from(model: element_type::Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
        }
    }
}

/// 获取要素类型列表（分页）
pub async fn list(
    State(ctx): State<AppContext>,
    Query(mut params): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<ElementTypeResponse>>> {
    params.validate();

    let db = &ctx.db;

    // 获取总数
    let total_count = element_type::Entity::find().count(db).await?;

    // 获取分页数据
    let element_types = element_type::Entity::find()
        .order_by_asc(element_type::Column::Id)
        .offset(params.offset())
        .limit(params.page_size)
        .all(db)
        .await?;

    let response_data: Vec<ElementTypeResponse> = element_types
        .into_iter()
        .map(ElementTypeResponse::from)
        .collect();

    let paginated_response = manual_paginate(total_count, response_data, &params);

    Ok(Json(paginated_response))
}

/// 获取所有要素类型（不分页，用于下拉选择）
pub async fn list_all(State(ctx): State<AppContext>) -> Result<Json<Vec<ElementTypeResponse>>> {
    let db = &ctx.db;

    let element_types = element_type::Entity::find()
        .order_by_asc(element_type::Column::Id)
        .all(db)
        .await?;

    let response_data: Vec<ElementTypeResponse> = element_types
        .into_iter()
        .map(ElementTypeResponse::from)
        .collect();

    Ok(Json(response_data))
}

/// 根据ID获取要素类型详情
pub async fn get_by_id(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
) -> Result<Json<ElementTypeResponse>> {
    let db = &ctx.db;

    let element_type = element_type::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    Ok(Json(ElementTypeResponse::from(element_type)))
}

/// 创建要素类型
pub async fn create(
    State(ctx): State<AppContext>,
    Json(req): Json<CreateElementTypeRequest>,
) -> Result<Json<ElementTypeResponse>> {
    let db = &ctx.db;

    let new_element_type = element_type::ActiveModel {
        name: Set(req.name),
        ..Default::default()
    };

    let element_type = new_element_type.insert(db).await?;

    Ok(Json(ElementTypeResponse::from(element_type)))
}

/// 更新要素类型
pub async fn update(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
    Json(req): Json<UpdateElementTypeRequest>,
) -> Result<Json<ElementTypeResponse>> {
    let db = &ctx.db;

    let element_type = element_type::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    let mut active_element_type: element_type::ActiveModel = element_type.into();

    if let Some(name) = req.name {
        active_element_type.name = Set(name);
    }

    let updated_element_type = active_element_type.update(db).await?;

    Ok(Json(ElementTypeResponse::from(updated_element_type)))
}

/// 删除要素类型
pub async fn delete(
    State(ctx): State<AppContext>,
    Path(id): Path<i32>,
) -> Result<Json<serde_json::Value>> {
    let db = &ctx.db;

    let element_type = element_type::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| Error::NotFound)?;

    element_type::Entity::delete_by_id(element_type.id)
        .exec(db)
        .await?;

    Ok(Json(serde_json::json!({
        "message": "Element type deleted successfully",
        "id": id
    })))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("element-types")
        .add("/", get(list))
        .add("/all", get(list_all))
        .add("/", post(create))
        .add("/{id}", get(get_by_id))
        .add("/{id}", put(update))
        .add("/{id}", axum::routing::delete(delete))
}
