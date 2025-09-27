use crate::models::device;
use axum::{
    extract::{
        ws::{WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    response::Response,
};
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::services::app_state;

#[derive(Debug, Deserialize)]
pub struct WebSocketQuery {
    pub device_id: Option<i32>,
}

/// WebSocket连接端点
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WebSocketQuery>,
    State(ctx): State<AppContext>,
) -> Response {
    let client_id = Uuid::new_v4().to_string();

    // 从应用上下文获取广播服务
    // 注意：这里需要在应用启动时将BroadcastService添加到AppContext中
    ws.on_upgrade(move |socket| handle_websocket_connection(socket, client_id, params.device_id))
}

/// 处理WebSocket连接
async fn handle_websocket_connection(socket: WebSocket, client_id: String, device_id: Option<i32>) {
    tracing::info!(
        "WebSocket connection established: client_id={}, device_id={:?}",
        client_id,
        device_id
    );

    // 获取服务管理器
    if let Some(service_manager) = app_state::get_service_manager() {
        service_manager
            .handle_websocket_connection(socket, client_id, device_id)
            .await;
    } else {
        tracing::error!("Service manager not initialized");
    }
}

/// 获取设备实时状态
pub async fn get_device_status(
    Path(device_uuid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 解析UUID字符串
    let uuid = match Uuid::parse_str(&device_uuid) {
        Ok(uuid) => uuid,
        Err(_) => {
            return format::json(serde_json::json!({
                "error": "Invalid UUID format",
                "device_uuid": device_uuid
            }));
        }
    };

    // 首先通过UUID查找设备的数字ID
    let device_id = match device::Entity::find()
        .filter(device::Column::Uuid.eq(uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device.id,
        Ok(None) => {
            return format::json(serde_json::json!({
                "error": "Device not found",
                "device_uuid": device_uuid
            }));
        }
        Err(e) => {
            return format::json(serde_json::json!({
                "error": format!("Database error: {}", e),
                "device_uuid": device_uuid
            }));
        }
    };

    let mut status = serde_json::json!({
        "device_id": device_id,
        "device_uuid": device_uuid,
        "status": "disconnected",
        "last_update": chrono::Utc::now().to_rfc3339(),
        "data": {},
        "websocket_connected": false,
        "mqtt_running": false
    });

    // 从服务管理器获取设备状态
    if let Some(service_manager) = app_state::get_service_manager() {
        // 检查WebSocket代理连接状态
        let ws_connected = service_manager
            .is_device_websocket_proxy_connected(device_id)
            .await;
        status["websocket_connected"] = serde_json::json!(ws_connected);

        // 检查MQTT运行状态
        let mqtt_running = service_manager.is_mqtt_running(device_id).await;
        status["mqtt_running"] = serde_json::json!(mqtt_running);

        // 如果WebSocket连接或MQTT运行，则认为设备已连接
        if ws_connected || mqtt_running {
            status["status"] = serde_json::json!("connected");
        }

        // 获取设备当前状态数据
        if let Some(device_data) = service_manager.get_device_state(device_id).await {
            status["data"] = device_data;
        }
    }

    format::json(status)
}

/// 获取所有设备状态
pub async fn get_all_device_status(State(ctx): State<AppContext>) -> Result<Response> {
    let mut devices = Vec::new();

    // 从服务管理器获取所有设备状态
    if let Some(service_manager) = app_state::get_service_manager() {
        let all_states = service_manager.get_all_device_states().await;
        for (device_id, data) in all_states {
            devices.push(serde_json::json!({
                "device_id": device_id,
                "data": data,
                "status": "connected"
            }));
        }
    }

    let status = serde_json::json!({
        "devices": devices,
        "total": devices.len(),
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    format::json(status)
}

/// 向设备发送命令
pub async fn send_device_command(
    Path(device_uuid): Path<String>,
    State(ctx): State<AppContext>,
    Json(command): Json<serde_json::Value>,
) -> Result<Response> {
    // 解析UUID字符串
    let uuid = match Uuid::parse_str(&device_uuid) {
        Ok(uuid) => uuid,
        Err(_) => {
            return format::json(serde_json::json!({
                "error": "Invalid UUID format",
                "device_uuid": device_uuid
            }));
        }
    };

    // 通过UUID查找设备ID
    let device_id = match device::Entity::find()
        .filter(device::Column::Uuid.eq(uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device.id,
        Ok(None) => {
            return format::json(serde_json::json!({
                "error": "Device not found",
                "device_uuid": device_uuid
            }));
        }
        Err(e) => {
            return format::json(serde_json::json!({
                "error": format!("Database error: {}", e),
                "device_uuid": device_uuid
            }));
        }
    };

    tracing::info!(
        "Sending command to device {} ({}): {:?}",
        device_id,
        device_uuid,
        command
    );

    let mut command_sent = false;

    // 通过设备WebSocket代理发送命令
    if let Some(service_manager) = app_state::get_service_manager() {
        if let Some(command_str) = command.as_str() {
            if let Ok(_) = service_manager
                .send_device_websocket_command(device_id, command_str.to_string())
                .await
            {
                command_sent = true;
            }
        }
    }

    let response = serde_json::json!({
        "device_id": device_id,
        "command_sent": command_sent,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    format::json(response)
}

/// 获取设备历史数据
pub async fn get_device_history(
    Path(device_uuid): Path<String>,
    Query(params): Query<HistoryQuery>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 解析UUID字符串
    let uuid = match Uuid::parse_str(&device_uuid) {
        Ok(uuid) => uuid,
        Err(_) => {
            return format::json(serde_json::json!({
                "error": "Invalid UUID format",
                "device_uuid": device_uuid
            }));
        }
    };

    // 通过UUID查找设备ID
    let device_id = match device::Entity::find()
        .filter(device::Column::Uuid.eq(uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device.id,
        Ok(None) => {
            return format::json(serde_json::json!({
                "error": "Device not found",
                "device_uuid": device_uuid
            }));
        }
        Err(e) => {
            return format::json(serde_json::json!({
                "error": format!("Database error: {}", e),
                "device_uuid": device_uuid
            }));
        }
    };
    use crate::models::device_realtime_data;
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect};

    let limit = params.limit.unwrap_or(100).min(1000); // 最大1000条
    let offset = params.offset.unwrap_or(0);

    let history_data = device_realtime_data::Entity::find()
        .filter(device_realtime_data::Column::DeviceId.eq(device_id))
        .order_by_desc(device_realtime_data::Column::ReceivedAt)
        .limit(limit)
        .offset(offset)
        .all(&ctx.db)
        .await?;

    let response_data: Vec<_> = history_data
        .into_iter()
        .map(|data| {
            serde_json::json!({
                "id": data.id,
                "device_id": data.device_id,
                "data_type": data.data_type,
                "data_content": data.data_content,
                "received_at": data.received_at.to_rfc3339(),
                "created_at": data.created_at.to_rfc3339()
            })
        })
        .collect();

    let response = serde_json::json!({
        "device_id": device_id,
        "data": response_data,
        "limit": limit,
        "offset": offset,
        "total": response_data.len()
    });

    format::json(response)
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<u64>,
    pub offset: Option<u64>,
    pub data_type: Option<String>, // "mqtt" 或 "websocket"
}

#[derive(Debug, Deserialize)]
pub struct MqttConnectRequest {
    pub port: u16,
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct MqttConnectResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceConnectRequest {
    pub port: u16,
}

#[derive(Debug, Serialize)]
pub struct DeviceConnectResponse {
    pub success: bool,
    pub message: String,
    pub device_id: Option<i32>,
}

/// 连接设备MQTT
pub async fn connect_device_mqtt(
    Path(device_uuid): Path<String>,
    State(ctx): State<AppContext>,
    Json(request): Json<MqttConnectRequest>,
) -> Result<Response> {
    // 解析UUID字符串
    let uuid = match Uuid::parse_str(&device_uuid) {
        Ok(uuid) => uuid,
        Err(_) => {
            return format::json(MqttConnectResponse {
                success: false,
                message: format!("Invalid UUID format: {}", device_uuid),
            });
        }
    };

    // 通过UUID查找设备ID
    let device_id = match device::Entity::find()
        .filter(device::Column::Uuid.eq(uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device.id,
        Ok(None) => {
            return format::json(MqttConnectResponse {
                success: false,
                message: format!("Device not found: {}", device_uuid),
            });
        }
        Err(e) => {
            return format::json(MqttConnectResponse {
                success: false,
                message: format!("Database error: {}", e),
            });
        }
    };

    tracing::info!(
        "Starting MQTT broker for device {} ({}): port={}, enabled={}",
        device_id,
        device_uuid,
        request.port,
        request.enabled
    );

    let mut success = false;
    let mut message = "Service manager not available".to_string();

    if let Some(service_manager) = app_state::get_service_manager() {
        // 检查MQTT是否已经在运行
        if service_manager.is_mqtt_running(device_id).await {
            success = true;
            message = "MQTT broker is already running".to_string();
        } else {
            match service_manager
                .add_device_mqtt_config(device_id, request.port, request.enabled)
                .await
            {
                Ok(_) => {
                    success = true;
                    message = "MQTT broker started successfully".to_string();
                }
                Err(e) => {
                    message = format!("Failed to start MQTT broker: {}", e);
                }
            }
        }
    }

    let response = MqttConnectResponse { success, message };
    format::json(response)
}

/// 连接设备WebSocket
pub async fn connect_device_websocket(
    Path(device_uuid): Path<String>,
    State(ctx): State<AppContext>,
    Json(request): Json<DeviceConnectRequest>,
) -> Result<Response> {
    // 解析UUID字符串
    let uuid = match Uuid::parse_str(&device_uuid) {
        Ok(uuid) => uuid,
        Err(_) => {
            return format::json(DeviceConnectResponse {
                success: false,
                message: format!("Invalid UUID format: {}", device_uuid),
                device_id: None,
            });
        }
    };

    // 通过UUID查找设备ID
    let device = match device::Entity::find()
        .filter(device::Column::Uuid.eq(uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device,
        Ok(None) => {
            return format::json(DeviceConnectResponse {
                success: false,
                message: format!("Device not found: {}", device_uuid),
                device_id: None,
            });
        }
        Err(e) => {
            return format::json(DeviceConnectResponse {
                success: false,
                message: format!("Database error: {}", e),
                device_id: None,
            });
        }
    };

    tracing::info!(
        "Creating WebSocket server for device {} ({}): port={}",
        device.id,
        device_uuid,
        request.port
    );

    let mut success = false;
    let mut message = "Service manager not available".to_string();

    if let Some(service_manager) = app_state::get_service_manager() {
        // 创建设备WebSocket代理（包含设备服务器和前端代理）
        match service_manager
            .create_device_websocket_proxy(device.id, device.uuid, request.port)
            .await
        {
            Ok(proxy_port) => {
                success = true;
                message = format!(
                    "Device WebSocket server created on port {}, proxy on port {}",
                    request.port, proxy_port
                );

                // 更新数据库中的设备连接状态和端口
                use crate::models::device;
                use sea_orm::{ActiveModelTrait, EntityTrait, Set};

                if let Ok(Some(device_model)) =
                    device::Entity::find_by_id(device.id).one(&ctx.db).await
                {
                    let mut active_device: device::ActiveModel = device_model.into();
                    active_device.is_connected = Set(true);
                    active_device.websocket_port = Set(Some(request.port as i32));
                    let _ = active_device.update(&ctx.db).await;
                }
            }
            Err(e) => {
                message = format!("Failed to create device WebSocket proxy: {}", e);
            }
        }
    }

    let response = DeviceConnectResponse {
        success,
        message,
        device_id: if success { Some(device.id) } else { None },
    };
    format::json(response)
}

/// 断开设备WebSocket连接
pub async fn disconnect_device_websocket(
    Path(device_uuid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 解析UUID字符串
    let uuid = match Uuid::parse_str(&device_uuid) {
        Ok(uuid) => uuid,
        Err(_) => {
            return format::json(DeviceConnectResponse {
                success: false,
                message: format!("Invalid UUID format: {}", device_uuid),
                device_id: None,
            });
        }
    };

    // 通过UUID查找设备ID
    let device = match device::Entity::find()
        .filter(device::Column::Uuid.eq(uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device,
        Ok(None) => {
            return format::json(DeviceConnectResponse {
                success: false,
                message: format!("Device not found: {}", device_uuid),
                device_id: None,
            });
        }
        Err(e) => {
            return format::json(DeviceConnectResponse {
                success: false,
                message: format!("Database error: {}", e),
                device_id: None,
            });
        }
    };

    tracing::info!("Disconnecting device {} ({})", device.id, device_uuid);

    if let Some(service_manager) = app_state::get_service_manager() {
        // 停止WebSocket代理（包含设备服务器和前端代理）
        service_manager
            .disconnect_device_websocket_proxy(device.id)
            .await;

        // 停止MQTT服务
        let _ = service_manager.remove_device_mqtt_config(device.id).await;

        // 更新数据库中的设备连接状态
        use crate::models::device;
        use sea_orm::{ActiveModelTrait, EntityTrait, Set};

        if let Ok(Some(device_model)) = device::Entity::find_by_id(device.id).one(&ctx.db).await {
            let mut active_device: device::ActiveModel = device_model.into();
            active_device.is_connected = Set(false);
            let _ = active_device.update(&ctx.db).await;
        }
    }

    let response = DeviceConnectResponse {
        success: true,
        message: "Device WebSocket disconnected successfully".to_string(),
        device_id: Some(device.id),
    };
    format::json(response)
}

/// 断开设备MQTT
pub async fn disconnect_device_mqtt(
    Path(device_uuid): Path<String>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 通过UUID查找设备ID
    let device_id = match device::Entity::find()
        .filter(device::Column::Uuid.eq(&device_uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device.id,
        Ok(None) => {
            return format::json(MqttConnectResponse {
                success: false,
                message: format!("Device not found: {}", device_uuid),
            });
        }
        Err(e) => {
            return format::json(MqttConnectResponse {
                success: false,
                message: format!("Database error: {}", e),
            });
        }
    };

    tracing::info!(
        "Disconnecting MQTT for device {} ({})",
        device_id,
        device_uuid
    );

    let mut success = false;
    let mut message = "Service manager not available".to_string();

    if let Some(service_manager) = app_state::get_service_manager() {
        match service_manager.remove_device_mqtt_config(device_id).await {
            Ok(_) => {
                success = true;
                message = "MQTT connection stopped successfully".to_string();
            }
            Err(e) => {
                message = format!("Failed to stop MQTT connection: {}", e);
            }
        }
    }

    let response = MqttConnectResponse { success, message };
    format::json(response)
}

#[derive(Debug, Deserialize)]
pub struct BatchDeleteRequest {
    pub ids: Vec<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHistoryRequest {
    pub data_type: String,
    pub data_content: serde_json::Value,
}

/// 批量删除历史记录
pub async fn batch_delete_history(
    Path(device_uuid): Path<String>,
    State(ctx): State<AppContext>,
    Json(payload): Json<BatchDeleteRequest>,
) -> Result<Response> {
    use crate::models::device_realtime_data;
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

    // 解析UUID并获取设备ID
    let uuid = match Uuid::parse_str(&device_uuid) {
        Ok(uuid) => uuid,
        Err(_) => {
            return format::json(serde_json::json!({
                "error": "Invalid UUID format"
            }));
        }
    };

    let device_id = match device::Entity::find()
        .filter(device::Column::Uuid.eq(uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device.id,
        Ok(None) => {
            return format::json(serde_json::json!({
                "error": "Device not found"
            }));
        }
        Err(e) => {
            return format::json(serde_json::json!({
                "error": format!("Database error: {}", e)
            }));
        }
    };

    // 删除指定的记录
    let delete_result = device_realtime_data::Entity::delete_many()
        .filter(device_realtime_data::Column::DeviceId.eq(device_id))
        .filter(device_realtime_data::Column::Id.is_in(payload.ids))
        .exec(&ctx.db)
        .await;

    match delete_result {
        Ok(result) => format::json(serde_json::json!({
            "success": true,
            "deleted_count": result.rows_affected
        })),
        Err(e) => format::json(serde_json::json!({
            "error": format!("Failed to delete records: {}", e)
        })),
    }
}

/// 更新历史记录
pub async fn update_history_record(
    Path((device_uuid, record_id)): Path<(String, i64)>,
    State(ctx): State<AppContext>,
    Json(payload): Json<UpdateHistoryRequest>,
) -> Result<Response> {
    use crate::models::device_realtime_data;
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

    // 解析UUID并获取设备ID
    let uuid = match Uuid::parse_str(&device_uuid) {
        Ok(uuid) => uuid,
        Err(_) => {
            return format::json(serde_json::json!({
                "error": "Invalid UUID format"
            }));
        }
    };

    let device_id = match device::Entity::find()
        .filter(device::Column::Uuid.eq(uuid))
        .one(&ctx.db)
        .await
    {
        Ok(Some(device)) => device.id,
        Ok(None) => {
            return format::json(serde_json::json!({
                "error": "Device not found"
            }));
        }
        Err(e) => {
            return format::json(serde_json::json!({
                "error": format!("Database error: {}", e)
            }));
        }
    };

    // 查找并更新记录
    let record = device_realtime_data::Entity::find_by_id(record_id)
        .filter(device_realtime_data::Column::DeviceId.eq(device_id))
        .one(&ctx.db)
        .await;

    match record {
        Ok(Some(record)) => {
            let mut active_record: device_realtime_data::ActiveModel = record.into();
            active_record.data_type = Set(payload.data_type);
            active_record.data_content = Set(payload.data_content);
            active_record.updated_at =
                Set(chrono::Utc::now()
                    .with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap()));

            match active_record.update(&ctx.db).await {
                Ok(updated_record) => format::json(serde_json::json!({
                    "success": true,
                    "data": updated_record
                })),
                Err(e) => format::json(serde_json::json!({
                    "error": format!("Failed to update record: {}", e)
                })),
            }
        }
        Ok(None) => format::json(serde_json::json!({
            "error": "Record not found"
        })),
        Err(e) => format::json(serde_json::json!({
            "error": format!("Database error: {}", e)
        })),
    }
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("realtime")
        .add("/ws", get(websocket_handler))
        .add("/devices", get(get_all_device_status))
        .add("/devices/{device_id}/status", get(get_device_status))
        .add("/devices/{device_id}/command", post(send_device_command))
        .add("/devices/{device_id}/history", get(get_device_history))
        .add(
            "/devices/{device_id}/history/batch",
            delete(batch_delete_history),
        )
        .add(
            "/devices/{device_id}/history/{record_id}",
            put(update_history_record),
        )
        .add(
            "/devices/{device_id}/mqtt/connect",
            post(connect_device_mqtt),
        )
        .add(
            "/devices/{device_id}/mqtt/disconnect",
            post(disconnect_device_mqtt),
        )
        .add(
            "/devices/{device_id}/websocket/connect",
            post(connect_device_websocket),
        )
        .add(
            "/devices/{device_id}/websocket/disconnect",
            post(disconnect_device_websocket),
        )
}
