use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{error, info, warn};

use crate::services::realtime_data::UnifiedRealtimeMessage;

pub type ClientId = String;
pub type DeviceId = i32;

#[derive(Debug, Clone)]
pub struct ClientConnection {
    pub client_id: ClientId,
    pub device_id: Option<DeviceId>, // 客户端关注的设备ID，None表示关注所有设备
    pub sender: tokio::sync::mpsc::UnboundedSender<Message>,
}

pub struct BroadcastService {
    clients: Arc<RwLock<HashMap<ClientId, ClientConnection>>>,
    unified_receiver: broadcast::Receiver<UnifiedRealtimeMessage>,
}

impl BroadcastService {
    pub fn new(unified_receiver: broadcast::Receiver<UnifiedRealtimeMessage>) -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            unified_receiver,
        }
    }

    /// 启动广播服务
    pub async fn start(&mut self) {
        let clients = Arc::clone(&self.clients);

        while let Ok(unified_msg) = self.unified_receiver.recv().await {
            info!("Broadcasting message for device {}", unified_msg.device_id);

            // 创建要发送的消息
            let broadcast_message = json!({
                "type": "realtime_data",
                "device_id": unified_msg.device_id,
                "message_type": unified_msg.message_type,
                "data": unified_msg.data,
                "timestamp": unified_msg.timestamp.to_rfc3339()
            });

            let message_text = broadcast_message.to_string();
            let ws_message = Message::Text(message_text.into());

            // 获取需要发送消息的客户端
            let clients_to_send = {
                let clients_guard = clients.read().await;
                clients_guard
                    .values()
                    .filter(|client| {
                        // 发送给关注此设备的客户端，或关注所有设备的客户端
                        client.device_id.is_none()
                            || client.device_id == Some(unified_msg.device_id)
                    })
                    .cloned()
                    .collect::<Vec<_>>()
            };

            // 发送消息给所有相关客户端
            for client in clients_to_send {
                if let Err(e) = client.sender.send(ws_message.clone()) {
                    warn!(
                        "Failed to send message to client {}: {}",
                        client.client_id, e
                    );
                    // 移除失效的客户端
                    let mut clients_guard = clients.write().await;
                    clients_guard.remove(&client.client_id);
                }
            }
        }
    }

    /// 添加新的WebSocket客户端
    pub async fn add_client(
        &self,
        client_id: ClientId,
        device_id: Option<DeviceId>,
    ) -> tokio::sync::mpsc::UnboundedReceiver<Message> {
        let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();

        let client = ClientConnection {
            client_id: client_id.clone(),
            device_id,
            sender,
        };

        {
            let mut clients = self.clients.write().await;
            clients.insert(client_id.clone(), client);
        }

        info!(
            "Added WebSocket client: {} (device_id: {:?})",
            client_id, device_id
        );
        receiver
    }

    /// 移除WebSocket客户端
    pub async fn remove_client(&self, client_id: &ClientId) {
        let mut clients = self.clients.write().await;
        if clients.remove(client_id).is_some() {
            info!("Removed WebSocket client: {}", client_id);
        }
    }

    /// 获取当前连接的客户端数量
    pub async fn get_client_count(&self) -> usize {
        let clients = self.clients.read().await;
        clients.len()
    }

    /// 获取关注特定设备的客户端数量
    pub async fn get_device_client_count(&self, device_id: DeviceId) -> usize {
        let clients = self.clients.read().await;
        clients
            .values()
            .filter(|client| client.device_id == Some(device_id) || client.device_id.is_none())
            .count()
    }

    /// 处理WebSocket连接
    pub async fn handle_websocket(
        &self,
        websocket: WebSocket,
        client_id: ClientId,
        device_id: Option<DeviceId>,
    ) {
        let mut receiver = self.add_client(client_id.clone(), device_id).await;
        let (mut ws_sender, mut ws_receiver) = websocket.split();

        // 发送欢迎消息
        let welcome_msg = json!({
            "type": "welcome",
            "client_id": client_id,
            "device_id": device_id,
            "message": "Connected to realtime data stream"
        });

        if let Err(e) = ws_sender
            .send(Message::Text(welcome_msg.to_string().into()))
            .await
        {
            error!("Failed to send welcome message: {}", e);
            self.remove_client(&client_id).await;
            return;
        }

        // 启动消息发送任务
        let client_id_clone = client_id.clone();
        let broadcast_service = self.clone();
        let send_task = tokio::spawn(async move {
            while let Some(message) = receiver.recv().await {
                if let Err(e) = ws_sender.send(message).await {
                    error!("Failed to send message to WebSocket: {}", e);
                    break;
                }
            }
            broadcast_service.remove_client(&client_id_clone).await;
        });

        // 启动消息接收任务（处理客户端发送的消息）
        let client_id_clone = client_id.clone();
        let broadcast_service_clone = self.clone();
        let receive_task = tokio::spawn(async move {
            while let Some(msg) = ws_receiver.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        // 处理客户端发送的文本消息
                        info!("Received message from client {}: {}", client_id_clone, text);

                        // 可以在这里处理客户端的控制消息，比如切换关注的设备
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                            if let Some(msg_type) = parsed.get("type").and_then(|v| v.as_str()) {
                                match msg_type {
                                    "subscribe_device" => {
                                        if let Some(new_device_id) =
                                            parsed.get("device_id").and_then(|v| v.as_i64())
                                        {
                                            // 更新客户端关注的设备
                                            // 这里可以实现动态切换设备的逻辑
                                            info!(
                                                "Client {} wants to subscribe to device {}",
                                                client_id_clone, new_device_id
                                            );
                                        }
                                    }
                                    "ping" => {
                                        // 响应ping消息
                                        let pong_msg = json!({
                                            "type": "pong",
                                            "timestamp": chrono::Utc::now().to_rfc3339()
                                        });
                                        // 这里需要发送响应，但由于架构限制，暂时记录日志
                                        info!("Received ping from client {}", client_id_clone);
                                    }
                                    _ => {
                                        warn!(
                                            "Unknown message type from client {}: {}",
                                            client_id_clone, msg_type
                                        );
                                    }
                                }
                            }
                        }
                    }
                    Ok(Message::Close(_)) => {
                        info!("WebSocket connection closed by client {}", client_id_clone);
                        break;
                    }
                    Err(e) => {
                        error!("WebSocket error for client {}: {}", client_id_clone, e);
                        break;
                    }
                    _ => {
                        // 忽略其他类型的消息
                    }
                }
            }
            broadcast_service_clone
                .remove_client(&client_id_clone)
                .await;
        });

        // 等待任务完成
        tokio::select! {
            _ = send_task => {
                info!("Send task completed for client {}", client_id);
            }
            _ = receive_task => {
                info!("Receive task completed for client {}", client_id);
            }
        }

        // 确保客户端被移除
        self.remove_client(&client_id).await;
    }
}

impl Clone for BroadcastService {
    fn clone(&self) -> Self {
        Self {
            clients: Arc::clone(&self.clients),
            unified_receiver: self.unified_receiver.resubscribe(),
        }
    }
}
