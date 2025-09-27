use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{error, info, warn};

use crate::models::{device, device_realtime_data};
use crate::services::mqtt_broker::{MqttBrokerMessage, MqttBrokerService};
use sea_orm::DatabaseConnection;

#[derive(Debug, Clone)]
pub struct MqttMessage {
    pub device_id: i32,
    pub topic: String,
    pub payload: JsonValue,
    pub timestamp: chrono::DateTime<chrono::FixedOffset>,
}

#[derive(Debug, Clone)]
pub struct MqttDeviceConfig {
    pub device_id: i32,
    pub port: u16,
    pub enabled: bool,
}

pub struct MqttService {
    db: Arc<DatabaseConnection>,
    message_sender: broadcast::Sender<MqttMessage>,
    brokers: Arc<RwLock<HashMap<i32, MqttBrokerService>>>,
    device_configs: Arc<RwLock<HashMap<i32, MqttDeviceConfig>>>,
}

impl MqttService {
    pub fn new(db: Arc<DatabaseConnection>) -> (Self, broadcast::Receiver<MqttMessage>) {
        let (message_sender, message_receiver) = broadcast::channel(1000);

        let service = Self {
            db,
            message_sender,
            brokers: Arc::new(RwLock::new(HashMap::new())),
            device_configs: Arc::new(RwLock::new(HashMap::new())),
        };

        (service, message_receiver)
    }

    /// 添加设备MQTT配置
    pub async fn add_device_config(
        &self,
        config: MqttDeviceConfig,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if !config.enabled {
            info!("MQTT is disabled for device {}", config.device_id);
            return Ok(());
        }

        info!(
            "Adding MQTT broker for device {} on port {}",
            config.device_id, config.port
        );

        // 存储配置
        {
            let mut configs = self.device_configs.write().await;
            configs.insert(config.device_id, config.clone());
        }

        // 启动MQTT broker
        let device_id = config.device_id;
        if let Err(e) = self.start_broker_for_device(config).await {
            let error_msg = format!(
                "Failed to start MQTT broker for device {}: {}",
                device_id, e
            );
            error!("{}", error_msg);
            return Err(error_msg.into());
        }

        Ok(())
    }

    /// 移除设备MQTT配置
    pub async fn remove_device_config(
        &self,
        device_id: i32,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Removing MQTT config for device {}", device_id);

        // 停止并移除broker
        {
            let mut brokers = self.brokers.write().await;
            if let Some(mut broker) = brokers.remove(&device_id) {
                broker.stop().await;
                info!("Stopped MQTT broker for device {}", device_id);
            }
        }

        // 移除配置
        {
            let mut configs = self.device_configs.write().await;
            configs.remove(&device_id);
        }

        Ok(())
    }

    /// 为设备启动MQTT broker
    async fn start_broker_for_device(
        &self,
        config: MqttDeviceConfig,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (mut broker_service, mut broker_receiver) = MqttBrokerService::new(config.port);

        // 启动broker
        broker_service.start().await?;
        info!(
            "Started MQTT broker for device {} on port {}",
            config.device_id, config.port
        );

        // 存储broker
        {
            let mut brokers = self.brokers.write().await;
            brokers.insert(config.device_id, broker_service);
        }

        // 启动消息监听
        let db = Arc::clone(&self.db);
        let message_sender = self.message_sender.clone();
        let device_id = config.device_id;

        tokio::spawn(async move {
            while let Ok(broker_msg) = broker_receiver.recv().await {
                info!(
                    "Received MQTT broker message for device {}: {:?}",
                    device_id, broker_msg.payload
                );

                // 存储到数据库
                if let Err(e) = device_realtime_data::Model::create_realtime_data(
                    &db,
                    device_id,
                    "mqtt",
                    broker_msg.payload.clone(),
                )
                .await
                {
                    error!("Failed to save MQTT data to database: {}", e);
                }

                // 转换为统一的MQTT消息格式
                let mqtt_message = MqttMessage {
                    device_id,
                    topic: broker_msg.topic,
                    payload: broker_msg.payload,
                    timestamp: broker_msg.timestamp,
                };

                // 发送消息到广播频道
                if let Err(e) = message_sender.send(mqtt_message) {
                    warn!("Failed to broadcast MQTT message: {}", e);
                }
            }
        });

        Ok(())
    }

    /// 从数据库加载所有设备的MQTT配置
    pub async fn load_device_configs(
        &self,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        let devices = device::Entity::find()
            .filter(device::Column::MqttEnabled.eq(true))
            .filter(device::Column::MqttPort.is_not_null())
            .filter(device::Column::IsActive.eq(true))
            .all(&*self.db)
            .await?;

        for device_model in devices {
            if let Some(port) = device_model.mqtt_port {
                let config = MqttDeviceConfig {
                    device_id: device_model.id,
                    port: port as u16,
                    enabled: device_model.mqtt_enabled,
                };

                if let Err(e) = self.add_device_config(config).await {
                    error!(
                        "Failed to add MQTT config for device {}: {}",
                        device_model.id, e
                    );
                }
            }
        }

        Ok(())
    }

    /// 获取消息发送器的克隆
    pub fn get_message_sender(&self) -> broadcast::Sender<MqttMessage> {
        self.message_sender.clone()
    }

    /// 检查设备MQTT是否正在运行
    pub async fn is_device_mqtt_running(&self, device_id: i32) -> bool {
        let brokers = self.brokers.read().await;
        brokers.contains_key(&device_id)
    }

    /// 获取所有设备配置
    pub async fn get_all_configs(&self) -> HashMap<i32, MqttDeviceConfig> {
        let configs = self.device_configs.read().await;
        configs.clone()
    }
}
