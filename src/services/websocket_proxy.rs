use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::services::realtime_data::{RealtimeDataService, WebSocketMessage};

pub struct WebSocketProxy {
    realtime_service: Arc<RealtimeDataService>,
    device_connections: Arc<
        RwLock<
            HashMap<
                i32,
                tokio_tungstenite::WebSocketStream<
                    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
                >,
            >,
        >,
    >,
}

impl WebSocketProxy {
    pub fn new(realtime_service: Arc<RealtimeDataService>) -> Self {
        Self {
            realtime_service,
            device_connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 连接到设备的WebSocket
    pub async fn connect_to_device(
        &self,
        device_id: i32,
        websocket_url: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!(
            "Connecting to device {} WebSocket: {}",
            device_id, websocket_url
        );

        // 解析WebSocket URL
        let url = url::Url::parse(websocket_url)?;

        // 创建WebSocket连接
        let (ws_stream, _) = tokio_tungstenite::connect_async(url).await?;

        // 存储连接
        {
            let mut connections = self.device_connections.write().await;
            connections.insert(device_id, ws_stream);
        }

        // 启动消息处理循环
        self.start_device_message_loop(device_id).await;

        Ok(())
    }

    /// 断开设备WebSocket连接
    pub async fn disconnect_device(&self, device_id: i32) {
        let mut connections = self.device_connections.write().await;
        if connections.remove(&device_id).is_some() {
            info!("Disconnected from device {} WebSocket", device_id);
        }
    }

    /// 启动设备消息处理循环
    async fn start_device_message_loop(&self, device_id: i32) {
        let device_connections = Arc::clone(&self.device_connections);
        let realtime_service = Arc::clone(&self.realtime_service);

        tokio::spawn(async move {
            loop {
                // 获取连接
                let mut ws_stream = {
                    let mut connections = device_connections.write().await;
                    match connections.remove(&device_id) {
                        Some(stream) => stream,
                        None => {
                            info!(
                                "Device {} WebSocket connection not found, stopping message loop",
                                device_id
                            );
                            break;
                        }
                    }
                };

                // 处理消息
                match ws_stream.next().await {
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Text(text))) => {
                        info!(
                            "Received WebSocket message from device {}: {}",
                            device_id, text
                        );

                        // 解析消息
                        if let Some(ws_msg) =
                            RealtimeDataService::parse_websocket_message(device_id, &text)
                        {
                            if let Err(e) = realtime_service.process_websocket_message(ws_msg).await
                            {
                                error!(
                                    "Failed to process WebSocket message from device {}: {}",
                                    device_id, e
                                );
                            }
                        } else {
                            warn!(
                                "Failed to parse WebSocket message from device {}: {}",
                                device_id, text
                            );
                        }

                        // 重新存储连接
                        {
                            let mut connections = device_connections.write().await;
                            connections.insert(device_id, ws_stream);
                        }
                    }
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Close(_))) => {
                        info!("Device {} WebSocket connection closed", device_id);
                        break;
                    }
                    Some(Err(e)) => {
                        error!("WebSocket error for device {}: {}", device_id, e);
                        // 可以在这里实现重连逻辑
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        break;
                    }
                    None => {
                        warn!("Device {} WebSocket stream ended", device_id);
                        break;
                    }
                    _ => {
                        // 忽略其他类型的消息
                        // 重新存储连接
                        {
                            let mut connections = device_connections.write().await;
                            connections.insert(device_id, ws_stream);
                        }
                    }
                }
            }

            // 清理连接
            {
                let mut connections = device_connections.write().await;
                connections.remove(&device_id);
            }
        });
    }

    /// 向设备发送WebSocket消息
    pub async fn send_to_device(
        &self,
        device_id: i32,
        message: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let device_connections = Arc::clone(&self.device_connections);

        let mut connections = device_connections.write().await;
        if let Some(ws_stream) = connections.get_mut(&device_id) {
            ws_stream
                .send(tokio_tungstenite::tungstenite::Message::Text(
                    message.to_string(),
                ))
                .await?;
            info!("Sent message to device {}: {}", device_id, message);
            Ok(())
        } else {
            Err(format!("Device {} WebSocket not connected", device_id).into())
        }
    }

    /// 获取已连接的设备列表
    pub async fn get_connected_devices(&self) -> Vec<i32> {
        let connections = self.device_connections.read().await;
        connections.keys().cloned().collect()
    }

    /// 检查设备是否已连接
    pub async fn is_device_connected(&self, device_id: i32) -> bool {
        let connections = self.device_connections.read().await;
        connections.contains_key(&device_id)
    }

    /// 从数据库加载设备WebSocket配置并连接
    pub async fn load_and_connect_devices(
        &self,
        db: &sea_orm::DatabaseConnection,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use crate::models::device;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        let devices = device::Entity::find()
            .filter(device::Column::IsActive.eq(true))
            .all(db)
            .await?;

        for device_model in devices {
            if let Some(port) = device_model.websocket_port {
                let websocket_url = format!("ws://localhost:{}", port);
                if let Err(e) = self
                    .connect_to_device(device_model.id, &websocket_url)
                    .await
                {
                    error!(
                        "Failed to connect to device {} WebSocket: {}",
                        device_model.id, e
                    );
                }
            }
        }

        Ok(())
    }
}
