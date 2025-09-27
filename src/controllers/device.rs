use axum::debug_handler;
use loco_rs::prelude::*;
use sea_orm::prelude::Expr;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde_json::json;
use uuid::Uuid;

use crate::models::{device, user};

/// 获取所有设备（无需认证）
#[debug_handler]
async fn list_devices(State(ctx): State<AppContext>) -> Result<Response> {
    // 获取所有设备
    let devices = device::Entity::find()
        .all(&ctx.db)
        .await?;

    let device_responses: Vec<device::DeviceResponse> = devices
        .into_iter()
        .map(device::DeviceResponse::from)
        .collect();

    format::json(device_responses)
}

/// 获取用户的所有设备（需要认证）
#[debug_handler]
async fn list_user_devices(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    // 根据JWT获取用户ID
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user_model) = user_entity else {
        return unauthorized("用户未找到，请重新登录");
    };

    // 获取用户的所有设备
    let devices = device::Entity::find()
        .filter(device::Column::UserId.eq(user_model.id))
        .all(&ctx.db)
        .await?;

    let device_responses: Vec<device::DeviceResponse> = devices
        .into_iter()
        .map(device::DeviceResponse::from)
        .collect();

    format::json(device_responses)
}

/// 创建新设备
#[debug_handler]
async fn create_device(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<device::CreateDeviceParams>,
) -> Result<Response> {
    // 根据JWT获取用户ID
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user_model) = user_entity else {
        return unauthorized("用户未找到，请重新登录");
    };

    // 创建临时设备模型用于验证连接
    let temp_device = device::Model {
        id: 0,
        uuid: Uuid::new_v4(),
        name: params.name.clone(),
        websocket_port: params.websocket_port,
        easynvr_url: params.easynvr_url.clone(),
        http_api_url: params.http_api_url.clone(),
        description: params.description.clone(),
        drone_model: params.drone_model.clone(),
        drone_brand: params.drone_brand.clone(),
        is_default: false,
        is_active: true,
        user_id: user_model.id,
        mqtt_port: params.mqtt_port,
        mqtt_enabled: params.mqtt_enabled.unwrap_or(false),
        is_connected: false,
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
    };

    // 验证设备连接
    if let Err(e) = temp_device.validate_connection().await {
        tracing::error!("Device validation error: {}", e);
        return bad_request(&format!("设备连接验证失败: {}", e));
    }

    // 连接验证成功，创建设备
    let device_uuid = Uuid::new_v4();

    let new_device = device::ActiveModel {
        uuid: Set(device_uuid),
        name: Set(params.name),
        websocket_port: Set(params.websocket_port),
        easynvr_url: Set(params.easynvr_url),
        http_api_url: Set(params.http_api_url),
        description: Set(params.description),
        drone_model: Set(params.drone_model),
        drone_brand: Set(params.drone_brand),
        is_default: Set(false),
        is_active: Set(true),
        user_id: Set(user_model.id),
        mqtt_port: Set(params.mqtt_port),
        mqtt_enabled: Set(params.mqtt_enabled.unwrap_or(false)),
        is_connected: Set(false),
        ..Default::default()
    };

    let device_model = new_device.insert(&ctx.db).await?;
    let response = device::DeviceResponse::from(device_model);

    format::json(response)
}

/// 获取单个设备
#[debug_handler]
async fn get_device(
    auth: auth::JWT,
    Path(device_uuid): Path<Uuid>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 根据JWT获取用户ID
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user_model) = user_entity else {
        return unauthorized("用户未找到，请重新登录");
    };

    // 获取设备
    let device_entity = device::Entity::find()
        .filter(device::Column::Uuid.eq(device_uuid))
        .filter(device::Column::UserId.eq(user_model.id))
        .one(&ctx.db)
        .await?;

    let Some(device_model) = device_entity else {
        return not_found();
    };

    let response = device::DeviceResponse::from(device_model);
    format::json(response)
}

/// 更新设备
#[debug_handler]
async fn update_device(
    auth: auth::JWT,
    Path(device_uuid): Path<Uuid>,
    State(ctx): State<AppContext>,
    Json(params): Json<device::UpdateDeviceParams>,
) -> Result<Response> {
    // 根据JWT获取用户ID
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user_model) = user_entity else {
        return unauthorized("用户未找到，请重新登录");
    };

    // 获取设备
    let device_entity = device::Entity::find()
        .filter(device::Column::Uuid.eq(device_uuid))
        .filter(device::Column::UserId.eq(user_model.id))
        .one(&ctx.db)
        .await?;

    let Some(device_model) = device_entity else {
        return not_found();
    };

    // 如果更新WebSocket端口，需要验证连接
    if let Some(new_port) = params.websocket_port {
        let temp_device = device::Model {
            websocket_port: Some(new_port),
            ..device_model.clone()
        };

        if let Err(e) = temp_device.validate_connection().await {
            tracing::error!("Device validation error: {}", e);
            return bad_request("New WebSocket port validation failed");
        }
    }

    // 如果设置为默认设备，需要先取消其他设备的默认状态
    if params.is_default == Some(true) {
        // 取消用户的其他默认设备
        device::Entity::update_many()
            .filter(device::Column::UserId.eq(user_model.id))
            .filter(device::Column::Id.ne(device_model.id))
            .col_expr(device::Column::IsDefault, Expr::value(false))
            .exec(&ctx.db)
            .await?;
    }

    // 更新设备
    let mut active_device: device::ActiveModel = device_model.into();

    if let Some(name) = params.name {
        active_device.name = Set(name);
    }
    if let Some(websocket_port) = params.websocket_port {
        active_device.websocket_port = Set(Some(websocket_port));
    }
    if let Some(easynvr_url) = params.easynvr_url {
        active_device.easynvr_url = Set(Some(easynvr_url));
    }
    if let Some(http_api_url) = params.http_api_url {
        active_device.http_api_url = Set(Some(http_api_url));
    }
    if let Some(description) = params.description {
        active_device.description = Set(Some(description));
    }
    if let Some(drone_model) = params.drone_model {
        active_device.drone_model = Set(Some(drone_model));
    }
    if let Some(drone_brand) = params.drone_brand {
        active_device.drone_brand = Set(Some(drone_brand));
    }
    if let Some(is_default) = params.is_default {
        active_device.is_default = Set(is_default);
    }
    if let Some(is_active) = params.is_active {
        active_device.is_active = Set(is_active);
    }
    if let Some(mqtt_port) = params.mqtt_port {
        active_device.mqtt_port = Set(Some(mqtt_port));
    }
    if let Some(mqtt_enabled) = params.mqtt_enabled {
        active_device.mqtt_enabled = Set(mqtt_enabled);
    }
    if let Some(is_connected) = params.is_connected {
        active_device.is_connected = Set(is_connected);
    }

    let updated_device = active_device.update(&ctx.db).await?;
    let response = device::DeviceResponse::from(updated_device);

    format::json(response)
}

/// 删除设备
#[debug_handler]
async fn delete_device(
    auth: auth::JWT,
    Path(device_uuid): Path<Uuid>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 根据JWT获取用户ID
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user_model) = user_entity else {
        return unauthorized("用户未找到，请重新登录");
    };

    // 获取设备
    let device_entity = device::Entity::find()
        .filter(device::Column::Uuid.eq(device_uuid))
        .filter(device::Column::UserId.eq(user_model.id))
        .one(&ctx.db)
        .await?;

    let Some(device_model) = device_entity else {
        return not_found();
    };

    // 删除设备
    device_model.delete(&ctx.db).await?;

    format::json(json!({
        "message": "Device deleted successfully"
    }))
}

/// 设置默认设备
#[debug_handler]
async fn set_default_device(
    auth: auth::JWT,
    Path(device_uuid): Path<Uuid>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 根据JWT获取用户ID
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user_model) = user_entity else {
        return unauthorized("用户未找到，请重新登录");
    };

    // 获取设备
    let device_entity = device::Entity::find()
        .filter(device::Column::Uuid.eq(device_uuid))
        .filter(device::Column::UserId.eq(user_model.id))
        .one(&ctx.db)
        .await?;

    let Some(device_model) = device_entity else {
        return not_found();
    };

    // 取消用户的其他默认设备
    device::Entity::update_many()
        .filter(device::Column::UserId.eq(user_model.id))
        .filter(device::Column::Id.ne(device_model.id))
        .col_expr(device::Column::IsDefault, Expr::value(false))
        .exec(&ctx.db)
        .await?;

    // 设置当前设备为默认
    let mut active_device: device::ActiveModel = device_model.into();
    active_device.is_default = Set(true);
    let updated_device = active_device.update(&ctx.db).await?;

    let response = device::DeviceResponse::from(updated_device);
    format::json(response)
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("devices")
        .add("/", get(list_devices))  // 无需认证的获取所有设备接口
        .add("/user", get(list_user_devices))  // 需要认证的获取用户设备接口
        .add("/", post(create_device))
        .add("/{device_uuid}", get(get_device))
        .add("/{device_uuid}", put(update_device))
        .add("/{device_uuid}", delete(delete_device))
        .add("/{device_uuid}/default", post(set_default_device))
}
