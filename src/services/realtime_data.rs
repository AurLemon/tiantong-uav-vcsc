use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, RwLock};
use tokio::time::interval;
use tracing::{error, info, warn};

use crate::models::device_realtime_data;
use crate::services::mqtt_service::MqttMessage;
use sea_orm::DatabaseConnection;

#[derive(Debug, Clone)]
pub struct WebSocketMessage {
    pub device_id: i32,
    pub field: String,
    pub value: String,
    pub timestamp: chrono::DateTime<chrono::FixedOffset>,
}

#[derive(Debug, Clone)]
pub struct UnifiedRealtimeMessage {
    pub device_id: i32,
    pub message_type: String,
    pub data: JsonValue,
    pub timestamp: chrono::DateTime<chrono::FixedOffset>,
}

#[derive(Debug, Clone)]
struct PendingDataEntry {
    device_id: i32,
    data_type: String,
    data_content: JsonValue,
    timestamp: chrono::DateTime<chrono::FixedOffset>,
}

#[derive(Clone)]
pub struct RealtimeDataService {
    db: Arc<DatabaseConnection>,
    unified_sender: broadcast::Sender<UnifiedRealtimeMessage>,
    device_states: Arc<RwLock<HashMap<i32, JsonValue>>>,
    pending_data: Arc<RwLock<Vec<PendingDataEntry>>>,    
    last_save_time: Arc<RwLock<HashMap<i32, Instant>>>,
}

impl RealtimeDataService {
    pub fn new(db: Arc<DatabaseConnection>) -> (Self, broadcast::Receiver<UnifiedRealtimeMessage>) {
        let (unified_sender, unified_receiver) = broadcast::channel(1000);

        let service = Self {
            db: Arc::clone(&db),
            unified_sender,
            device_states: Arc::new(RwLock::new(HashMap::new())),
            pending_data: Arc::new(RwLock::new(Vec::new())),
            last_save_time: Arc::new(RwLock::new(HashMap::new())),
        };

        // 启动批量存储任务
        let service_clone = service.clone();
        tokio::spawn(async move {
            service_clone.start_batch_save_task().await;
        });

        (service, unified_receiver)
    }

    /// 获取统一消息广播的订阅
    pub fn subscribe_unified_messages(&self) -> broadcast::Receiver<UnifiedRealtimeMessage> {
        self.unified_sender.subscribe()
    }

    /// 启动批量存储任务
    async fn start_batch_save_task(&self) {
        let mut interval = interval(Duration::from_secs(5));

        loop {
            interval.tick().await;
            if let Err(e) = self.flush_pending_data().await {
                error!("Failed to flush pending data: {}", e);
            }
        }
    }

    /// 刷新待存储的数据到数据库
    async fn flush_pending_data(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let pending_data = {
            let mut pending = self.pending_data.write().await;
            if pending.is_empty() {
                return Ok(());
            }
            let data = pending.clone();
            pending.clear();
            data
        };

        if !pending_data.is_empty() {
            info!(
                "Flushing {} pending data entries to database",
                pending_data.len()
            );

            // 批量插入数据
            for entry in pending_data {
                if let Err(e) = device_realtime_data::Model::create_realtime_data(
                    &self.db,
                    entry.device_id,
                    &entry.data_type,
                    entry.data_content,
                )
                .await
                {
                    error!(
                        "Failed to save realtime data for device {}: {}",
                        entry.device_id, e
                    );
                }
            }
        }

        Ok(())
    }

    /// 检查是否应该立即保存数据（基于时间间隔）
    async fn should_save_immediately(&self, device_id: i32) -> bool {
        const IMMEDIATE_SAVE_INTERVAL: Duration = Duration::from_secs(30); // 30秒强制保存一次

        let mut last_save_times = self.last_save_time.write().await;
        let now = Instant::now();

        if let Some(last_save) = last_save_times.get(&device_id) {
            if now.duration_since(*last_save) >= IMMEDIATE_SAVE_INTERVAL {
                last_save_times.insert(device_id, now);
                return true;
            }
        } else {
            last_save_times.insert(device_id, now);
            return true;
        }

        false
    }

    /// 启动服务，监听MQTT消息
    pub async fn start_mqtt_listener(&self, mut mqtt_receiver: broadcast::Receiver<MqttMessage>) {
        let unified_sender = self.unified_sender.clone();
        let device_states = Arc::clone(&self.device_states);
        let pending_data = Arc::clone(&self.pending_data);
        let last_save_time = Arc::clone(&self.last_save_time);
        let db = Arc::clone(&self.db);

        tokio::spawn(async move {
            while let Ok(mqtt_msg) = mqtt_receiver.recv().await {
                info!("Processing MQTT message for device {}", mqtt_msg.device_id);

                // 检查是否需要立即保存
                let should_save_now = {
                    const IMMEDIATE_SAVE_INTERVAL: std::time::Duration =
                        std::time::Duration::from_secs(30);
                    let mut last_save_times = last_save_time.write().await;
                    let now = std::time::Instant::now();

                    if let Some(last_save) = last_save_times.get(&mqtt_msg.device_id) {
                        if now.duration_since(*last_save) >= IMMEDIATE_SAVE_INTERVAL {
                            last_save_times.insert(mqtt_msg.device_id, now);
                            true
                        } else {
                            false
                        }
                    } else {
                        last_save_times.insert(mqtt_msg.device_id, now);
                        true
                    }
                };

                if should_save_now {
                    // 立即保存到数据库
                    if let Err(e) = device_realtime_data::Model::create_realtime_data(
                        &db,
                        mqtt_msg.device_id,
                        "mqtt",
                        mqtt_msg.payload.clone(),
                    )
                    .await
                    {
                        error!(
                            "Failed to save MQTT data for device {}: {}",
                            mqtt_msg.device_id, e
                        );
                    }
                } else {
                    // 添加到待存储队列
                    let pending_entry = PendingDataEntry {
                        device_id: mqtt_msg.device_id,
                        data_type: "mqtt".to_string(),
                        data_content: mqtt_msg.payload.clone(),
                        timestamp: mqtt_msg.timestamp,
                    };

                    let mut pending = pending_data.write().await;
                    pending.push(pending_entry);
                }

                // 更新设备状态
                {
                    let mut states = device_states.write().await;
                    let current_state = states
                        .entry(mqtt_msg.device_id)
                        .or_insert_with(|| json!({}));

                    // 合并MQTT数据到当前状态
                    if let JsonValue::Object(ref mut current_obj) = current_state {
                        if let JsonValue::Object(mqtt_obj) = &mqtt_msg.payload {
                            for (key, value) in mqtt_obj {
                                current_obj.insert(key.clone(), value.clone());
                            }
                        }
                    }
                }

                // 创建统一消息
                let unified_msg = UnifiedRealtimeMessage {
                    device_id: mqtt_msg.device_id,
                    message_type: "mqtt".to_string(),
                    data: mqtt_msg.payload,
                    timestamp: mqtt_msg.timestamp,
                };

                // 广播统一消息
                if let Err(e) = unified_sender.send(unified_msg) {
                    warn!("Failed to broadcast unified MQTT message: {}", e);
                }
            }
        });
    }

    /// 处理WebSocket消息
    pub async fn process_websocket_message(
        &self,
        ws_msg: WebSocketMessage,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!(
            "Processing WebSocket message for device {}: {}:{}",
            ws_msg.device_id, ws_msg.field, ws_msg.value
        );

        // 解析WebSocket消息格式 (field:value)
        let field_name = ws_msg.field.clone();
        let field_value = ws_msg.value.clone();
        let json_data = json!({
            field_name: field_value
        });

        // 检查是否需要立即保存
        let should_save_now = self.should_save_immediately(ws_msg.device_id).await;

        if should_save_now {
            // 立即保存到数据库
            device_realtime_data::Model::create_realtime_data(
                &self.db,
                ws_msg.device_id,
                "websocket",
                json_data.clone(),
            )
            .await?;
        } else {
            // 添加到待存储队列
            let pending_entry = PendingDataEntry {
                device_id: ws_msg.device_id,
                data_type: "websocket".to_string(),
                data_content: json_data.clone(),
                timestamp: ws_msg.timestamp,
            };

            let mut pending_data = self.pending_data.write().await;
            pending_data.push(pending_entry);
        }

        // 更新设备状态
        {
            let mut states = self.device_states.write().await;
            let current_state = states.entry(ws_msg.device_id).or_insert_with(|| json!({}));

            if let JsonValue::Object(ref mut current_obj) = current_state {
                current_obj.insert(ws_msg.field.clone(), json!(ws_msg.value));
            }
        }

        // 创建统一消息 - 直接传递原始的field:value格式
        let raw_message = format!("{}:{}", ws_msg.field, ws_msg.value);
        let unified_msg = UnifiedRealtimeMessage {
            device_id: ws_msg.device_id,
            message_type: "websocket".to_string(),
            data: json!(raw_message),
            timestamp: ws_msg.timestamp,
        };

        // 广播统一消息
        if let Err(e) = self.unified_sender.send(unified_msg) {
            warn!("Failed to broadcast unified WebSocket message: {}", e);
        }

        Ok(())
    }

    /// 获取设备当前状态
    pub async fn get_device_state(&self, device_id: i32) -> Option<JsonValue> {
        let states = self.device_states.read().await;
        states.get(&device_id).cloned()
    }

    /// 获取所有设备状态
    pub async fn get_all_device_states(&self) -> HashMap<i32, JsonValue> {
        let states = self.device_states.read().await;
        states.clone()
    }

    /// 获取统一消息发送器
    pub fn get_unified_sender(&self) -> broadcast::Sender<UnifiedRealtimeMessage> {
        self.unified_sender.clone()
    }

    /// 解析WebSocket消息字符串 (格式: "device_id:field:value" 或 "field:value")
    pub fn parse_websocket_message(device_id: i32, message: &str) -> Option<WebSocketMessage> {
        let parts: Vec<&str> = message.splitn(3, ':').collect();

        let (field, value) = if parts.len() == 3 {
            // 格式: "device_id:field:value" - 跳过设备ID，使用字段和值
            (parts[1].trim().to_string(), parts[2].trim().to_string())
        } else if parts.len() == 2 {
            // 格式: "field:value" - 直接使用字段和值
            (parts[0].trim().to_string(), parts[1].trim().to_string())
        } else {
            return None;
        };

        let timestamp =
            chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap());

        Some(WebSocketMessage {
            device_id,
            field,
            value,
            timestamp,
        })
    }

    /// 从数据库加载设备历史状态
    pub async fn load_device_states(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use sea_orm::{EntityTrait, QueryOrder, QuerySelect};

        // 获取每个设备的最新数据
        let latest_data = device_realtime_data::Entity::find()
            .order_by_desc(device_realtime_data::Column::ReceivedAt)
            .limit(1000) // 限制查询数量
            .all(&*self.db)
            .await?;

        let mut device_data: HashMap<i32, JsonValue> = HashMap::new();

        for data in latest_data {
            let device_state = device_data
                .entry(data.device_id)
                .or_insert_with(|| json!({}));

            if let JsonValue::Object(ref mut state_obj) = device_state {
                if let JsonValue::Object(data_obj) = &data.data_content {
                    for (key, value) in data_obj {
                        state_obj.insert(key.clone(), value.clone());
                    }
                }
            }
        }

        // 更新内存中的状态
        {
            let mut states = self.device_states.write().await;
            *states = device_data;
        }

        info!(
            "Loaded device states for {} devices",
            self.device_states.read().await.len()
        );
        Ok(())
    }
}
