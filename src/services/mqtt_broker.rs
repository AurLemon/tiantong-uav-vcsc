use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tokio::sync::{broadcast, oneshot};
use tracing::{error, info, warn};

/// 清理Unicode转义序列，移除控制字符
fn clean_unicode_escapes(input: &str) -> String {
    // 移除常见的控制字符和Unicode转义序列
    input
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t')
        .collect::<String>()
        .replace("\\u0000", "")
        .replace("\\u000e", "")
        .replace("\\u001f", "")
        .replace("\\u007f", "")
        // 移除其他常见的控制字符转义序列
        .replace("\\u0001", "")
        .replace("\\u0002", "")
        .replace("\\u0003", "")
        .replace("\\u0004", "")
        .replace("\\u0005", "")
        .replace("\\u0006", "")
        .replace("\\u0007", "")
        .replace("\\u0008", "")
        .replace("\\u000b", "")
        .replace("\\u000c", "")
        .replace("\\u000f", "")
}

#[derive(Debug, Clone)]
pub struct MqttBrokerMessage {
    pub device_id: Option<i32>, // 可能无法确定设备ID
    pub client_id: String,
    pub topic: String,
    pub payload: JsonValue,
    pub timestamp: chrono::DateTime<chrono::FixedOffset>,
}

pub struct MqttBrokerService {
    port: u16,
    shutdown_tx: Option<oneshot::Sender<()>>,
    message_sender: broadcast::Sender<MqttBrokerMessage>,
    connected_clients: Arc<RwLock<HashMap<String, ClientInfo>>>,
}

#[derive(Debug, Clone)]
struct ClientInfo {
    client_id: String,
    device_id: Option<i32>,
    connected_at: chrono::DateTime<chrono::FixedOffset>,
    last_seen: chrono::DateTime<chrono::FixedOffset>,
}

impl MqttBrokerService {
    pub fn new(port: u16) -> (Self, broadcast::Receiver<MqttBrokerMessage>) {
        let (message_sender, message_receiver) = broadcast::channel(1000);

        let service = Self {
            port,
            shutdown_tx: None,
            message_sender,
            connected_clients: Arc::new(RwLock::new(HashMap::new())),
        };

        (service, message_receiver)
    }

    /// 启动简单的MQTT broker (TCP服务器)
    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Starting simple MQTT broker on port {}", self.port);

        let addr = format!("0.0.0.0:{}", self.port);
        let listener = TcpListener::bind(&addr).await?;

        // 创建关闭信号
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel();
        self.shutdown_tx = Some(shutdown_tx);

        let message_sender = self.message_sender.clone();
        let connected_clients = Arc::clone(&self.connected_clients);

        tokio::spawn(async move {
            info!("MQTT broker listening on {}", addr);

            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, addr)) => {
                                info!("New MQTT client connected from {}", addr);

                                let client_id = format!("client_{}", addr);
                                let clients = Arc::clone(&connected_clients);
                                let sender = message_sender.clone();

                                // 为每个客户端创建处理任务
                                tokio::spawn(async move {
                                    if let Err(e) = handle_mqtt_client(stream, client_id, clients, sender).await {
                                        error!("Error handling MQTT client {}: {}", addr, e);
                                    }
                                });
                            }
                            Err(e) => {
                                error!("Failed to accept connection: {}", e);
                            }
                        }
                    }
                    _ = &mut shutdown_rx => {
                        info!("MQTT broker shutdown signal received");
                        break;
                    }
                }
            }
        });

        // 等待一小段时间确保broker启动
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        info!("Simple MQTT broker started on port {}", self.port);
        Ok(())
    }

    /// 停止MQTT broker
    pub async fn stop(&mut self) {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            if let Err(_) = shutdown_tx.send(()) {
                warn!("Failed to send shutdown signal to MQTT broker");
            } else {
                info!("MQTT broker shutdown signal sent");
            }
        }
    }

    /// 获取连接的客户端列表
    pub async fn get_connected_clients(&self) -> Vec<ClientInfo> {
        let clients = self.connected_clients.read().await;
        clients.values().cloned().collect()
    }

    /// 检查broker是否正在运行
    pub fn is_running(&self) -> bool {
        self.shutdown_tx.is_some()
    }

    /// 获取消息发送器
    pub fn get_message_sender(&self) -> broadcast::Sender<MqttBrokerMessage> {
        self.message_sender.clone()
    }

    /// 手动添加客户端信息（用于测试或外部集成）
    pub async fn add_client_info(&self, client_id: String, device_id: Option<i32>) {
        let now =
            chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap());

        let client_info = ClientInfo {
            client_id: client_id.clone(),
            device_id,
            connected_at: now,
            last_seen: now,
        };

        let mut clients = self.connected_clients.write().await;
        clients.insert(client_id, client_info);
    }

    /// 模拟接收到MQTT消息（用于测试）
    pub async fn simulate_message(
        &self,
        client_id: String,
        topic: String,
        payload: String,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let timestamp =
            chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap());

        // 清理Unicode转义序列
        let cleaned_payload = clean_unicode_escapes(&payload);

        // 尝试解析JSON
        let json_payload = match serde_json::from_str::<JsonValue>(&cleaned_payload) {
            Ok(json) => json,
            Err(_) => json!({
                "raw_message": cleaned_payload,
                "message_type": "text"
            }),
        };

        // 查找设备ID
        let device_id = {
            let clients = self.connected_clients.read().await;
            clients.get(&client_id).and_then(|info| info.device_id)
        };

        let message = MqttBrokerMessage {
            device_id,
            client_id,
            topic,
            payload: json_payload,
            timestamp,
        };

        self.message_sender.send(message)?;
        Ok(())
    }
}

impl Drop for MqttBrokerService {
    fn drop(&mut self) {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            let _ = shutdown_tx.send(());
        }
    }
}

/// 处理MQTT客户端连接（简化版）
async fn handle_mqtt_client(
    mut stream: tokio::net::TcpStream,
    client_id: String,
    connected_clients: Arc<RwLock<HashMap<String, ClientInfo>>>,
    message_sender: broadcast::Sender<MqttBrokerMessage>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let now = chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap());

    // 添加客户端信息
    {
        let mut clients = connected_clients.write().await;
        clients.insert(
            client_id.clone(),
            ClientInfo {
                client_id: client_id.clone(),
                device_id: None,
                connected_at: now,
                last_seen: now,
            },
        );
    }

    info!("MQTT client {} connected", client_id);

    // 发送CONNACK响应（简化的MQTT协议）
    let connack = [0x20, 0x02, 0x00, 0x00]; // CONNACK with success
    stream.write_all(&connack).await?;

    let mut buffer = [0; 1024];

    loop {
        match stream.read(&mut buffer).await {
            Ok(0) => {
                // 连接关闭
                info!("MQTT client {} disconnected", client_id);
                break;
            }
            Ok(n) => {
                // 简化的MQTT消息解析
                if n >= 2 {
                    let message_type = (buffer[0] & 0xF0) >> 4;

                    if message_type == 3 {
                        // PUBLISH
                        // 简化的PUBLISH消息解析
                        if let Ok(payload) = String::from_utf8(buffer[2..n].to_vec()) {
                            info!("Received MQTT message from {}: {}", client_id, payload);

                            // 清理Unicode转义序列
                            let cleaned_payload = clean_unicode_escapes(&payload);

                            // 尝试解析JSON
                            let json_payload =
                                match serde_json::from_str::<JsonValue>(&cleaned_payload) {
                                    Ok(json) => json,
                                    Err(_) => json!({
                                        "raw_message": cleaned_payload,
                                        "message_type": "text"
                                    }),
                                };

                            // 发送消息到广播频道
                            let broker_message = MqttBrokerMessage {
                                device_id: None, // 暂时无法确定设备ID
                                client_id: client_id.clone(),
                                topic: "data".to_string(), // 简化的主题
                                payload: json_payload,
                                timestamp: chrono::Utc::now().with_timezone(
                                    &chrono::FixedOffset::east_opt(8 * 3600).unwrap(),
                                ),
                            };

                            if let Err(e) = message_sender.send(broker_message) {
                                warn!("Failed to broadcast MQTT message: {}", e);
                            }
                        }
                    }
                }

                // 发送PUBACK响应（如果需要）
                if buffer[0] & 0x06 != 0 {
                    // QoS > 0
                    let puback = [0x40, 0x02, buffer[2], buffer[3]]; // PUBACK
                    let _ = stream.write_all(&puback).await;
                }
            }
            Err(e) => {
                error!("Error reading from MQTT client {}: {}", client_id, e);
                break;
            }
        }
    }

    // 移除客户端信息
    {
        let mut clients = connected_clients.write().await;
        clients.remove(&client_id);
    }

    Ok(())
}
