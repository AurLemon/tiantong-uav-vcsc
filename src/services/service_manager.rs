use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::services::{
    broadcast::BroadcastService, device_websocket_proxy::DeviceWebSocketProxyService,
    mqtt_service::MqttService, realtime_data::RealtimeDataService, websocket_proxy::WebSocketProxy,
};
use sea_orm::DatabaseConnection;

pub struct ServiceManager {
    pub mqtt_service: Arc<MqttService>,
    pub realtime_service: Arc<RealtimeDataService>,
    pub websocket_proxy: Arc<WebSocketProxy>,
    pub device_websocket_proxy: Arc<DeviceWebSocketProxyService>,
    pub broadcast_service: Arc<RwLock<BroadcastService>>,
    db: Arc<DatabaseConnection>,
}

impl ServiceManager {
    /// 创建新的服务管理器
    pub async fn new(db: Arc<DatabaseConnection>) -> Self {
        info!("Initializing service manager...");

        // 创建MQTT服务
        let (mqtt_service, mqtt_receiver) = MqttService::new(Arc::clone(&db));
        let mqtt_service = Arc::new(mqtt_service);

        // 创建实时数据服务
        let (realtime_service, unified_receiver) = RealtimeDataService::new(Arc::clone(&db));
        let realtime_service = Arc::new(realtime_service);

        // 创建WebSocket代理
        let websocket_proxy = Arc::new(WebSocketProxy::new(Arc::clone(&realtime_service)));

        // 创建设备WebSocket代理服务
        let device_websocket_proxy = Arc::new(DeviceWebSocketProxyService::new(
            Arc::clone(&realtime_service),
            Arc::clone(&mqtt_service),
            realtime_service.subscribe_unified_messages(), // 订阅统一广播消息
        ));

        // 创建广播服务
        let broadcast_service = Arc::new(RwLock::new(BroadcastService::new(unified_receiver)));

        // 启动MQTT消息监听
        realtime_service.start_mqtt_listener(mqtt_receiver).await;

        info!("Service manager initialized successfully");

        Self {
            mqtt_service,
            realtime_service,
            websocket_proxy,
            device_websocket_proxy,
            broadcast_service,
            db,
        }
    }

    /// 启动所有服务
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Starting all services...");

        // 加载设备配置（MQTT连接失败不会阻塞启动）
        if let Err(e) = self.mqtt_service.load_device_configs().await {
            error!("Failed to load MQTT device configs: {}", e);
        }

        if let Err(e) = self
            .websocket_proxy
            .load_and_connect_devices(&*self.db)
            .await
        {
            error!("Failed to load WebSocket device configs: {}", e);
        }

        // 加载设备历史状态
        if let Err(e) = self.realtime_service.load_device_states().await {
            error!("Failed to load device states: {}", e);
        }

        // 自动连接已连接的设备
        if let Err(e) = self.auto_connect_devices().await {
            error!("Failed to auto-connect devices: {}", e);
        }

        // 启动广播服务
        let broadcast_service = Arc::clone(&self.broadcast_service);
        tokio::spawn(async move {
            let mut service = broadcast_service.write().await;
            service.start().await;
        });

        info!("All services started successfully");
        Ok(())
    }

    /// 自动连接已连接的设备
    async fn auto_connect_devices(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use crate::models::device;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        // 查找所有已连接的设备
        let connected_devices = device::Entity::find()
            .filter(device::Column::IsConnected.eq(true))
            .filter(device::Column::IsActive.eq(true))
            .all(&*self.db)
            .await?;

        for device_model in connected_devices {
            info!(
                "Auto-connecting device {} ({})",
                device_model.id, device_model.uuid
            );

            // 创建设备WebSocket代理
            if let Some(port) = device_model.websocket_port {
                if let Err(e) = self
                    .create_device_websocket_proxy(device_model.id, device_model.uuid, port as u16)
                    .await
                {
                    error!(
                        "Failed to auto-start device {} WebSocket proxy: {}",
                        device_model.id, e
                    );
                }
            }
        }

        Ok(())
    }

    /// 添加设备MQTT配置
    pub async fn add_device_mqtt_config(
        &self,
        device_id: i32,
        port: u16,
        enabled: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use crate::services::mqtt_service::MqttDeviceConfig;

        let config = MqttDeviceConfig {
            device_id,
            port,
            enabled,
        };

        self.mqtt_service.add_device_config(config).await
    }

    /// 移除设备MQTT配置
    pub async fn remove_device_mqtt_config(
        &self,
        device_id: i32,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.mqtt_service.remove_device_config(device_id).await
    }

    /// 连接设备WebSocket (旧方法，保留兼容性)
    pub async fn connect_device_websocket(
        &self,
        device_id: i32,
        websocket_url: String,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.websocket_proxy
            .connect_to_device(device_id, &websocket_url)
            .await
    }

    /// 断开设备WebSocket (旧方法，保留兼容性)
    pub async fn disconnect_device_websocket(&self, device_id: i32) {
        self.websocket_proxy.disconnect_device(device_id).await
    }

    /// 向设备发送WebSocket命令
    pub async fn send_device_command(
        &self,
        device_id: i32,
        command: String,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.websocket_proxy
            .send_to_device(device_id, &command)
            .await
    }

    /// 获取设备当前状态
    pub async fn get_device_state(&self, device_id: i32) -> Option<serde_json::Value> {
        self.realtime_service.get_device_state(device_id).await
    }

    /// 获取所有设备状态
    pub async fn get_all_device_states(&self) -> std::collections::HashMap<i32, serde_json::Value> {
        self.realtime_service.get_all_device_states().await
    }

    /// 添加WebSocket客户端
    pub async fn add_websocket_client(
        &self,
        client_id: String,
        device_id: Option<i32>,
    ) -> tokio::sync::mpsc::UnboundedReceiver<axum::extract::ws::Message> {
        let broadcast_service = self.broadcast_service.read().await;
        broadcast_service.add_client(client_id, device_id).await
    }

    /// 移除WebSocket客户端
    pub async fn remove_websocket_client(&self, client_id: &str) {
        let broadcast_service = self.broadcast_service.read().await;
        broadcast_service
            .remove_client(&client_id.to_string())
            .await
    }

    /// 处理WebSocket连接
    pub async fn handle_websocket_connection(
        &self,
        websocket: axum::extract::ws::WebSocket,
        client_id: String,
        device_id: Option<i32>,
    ) {
        let broadcast_service = self.broadcast_service.read().await;
        broadcast_service
            .handle_websocket(websocket, client_id, device_id)
            .await
    }

    /// 获取数据库连接（内部使用）
    fn get_db(&self) -> Arc<DatabaseConnection> {
        Arc::clone(&self.db)
    }

    /// 获取连接的设备数量
    pub async fn get_connected_device_count(&self) -> usize {
        self.websocket_proxy.get_connected_devices().await.len()
    }

    /// 获取WebSocket客户端数量
    pub async fn get_websocket_client_count(&self) -> usize {
        let broadcast_service = self.broadcast_service.read().await;
        broadcast_service.get_client_count().await
    }

    /// 检查设备是否已连接
    pub async fn is_device_connected(&self, device_id: i32) -> bool {
        self.websocket_proxy.is_device_connected(device_id).await
    }

    /// 检查设备MQTT是否正在运行
    pub async fn is_mqtt_running(&self, device_id: i32) -> bool {
        self.mqtt_service.is_device_mqtt_running(device_id).await
    }

    /// 创建设备WebSocket代理
    pub async fn create_device_websocket_proxy(
        &self,
        device_id: i32,
        device_uuid: uuid::Uuid,
        device_port: u16,
    ) -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
        self.device_websocket_proxy
            .create_device_proxy(device_id, device_uuid, device_port)
            .await
    }

    /// 断开设备WebSocket代理
    pub async fn disconnect_device_websocket_proxy(&self, device_id: i32) {
        self.device_websocket_proxy
            .disconnect_device(device_id)
            .await
    }

    /// 检查设备WebSocket代理是否已连接
    pub async fn is_device_websocket_proxy_connected(&self, device_id: i32) -> bool {
        self.device_websocket_proxy
            .is_device_connected(device_id)
            .await
    }

    /// 向设备发送WebSocket命令
    pub async fn send_device_websocket_command(
        &self,
        device_id: i32,
        command: String,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.device_websocket_proxy
            .send_device_command(device_id, &command)
            .await
    }

    /// 处理WebSocket消息（从设备接收）
    pub async fn process_websocket_message(
        &self,
        device_id: i32,
        message: String,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(ws_msg) = RealtimeDataService::parse_websocket_message(device_id, &message) {
            self.realtime_service
                .process_websocket_message(ws_msg)
                .await?;
        }
        Ok(())
    }

    /// 获取设备历史数据
    pub async fn get_device_history(
        &self,
        device_id: i32,
        limit: u64,
        offset: u64,
        data_type: Option<String>,
    ) -> Result<Vec<crate::models::device_realtime_data::Model>, sea_orm::DbErr> {
        use crate::models::device_realtime_data;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect};

        let mut query = device_realtime_data::Entity::find()
            .filter(device_realtime_data::Column::DeviceId.eq(device_id))
            .order_by_desc(device_realtime_data::Column::ReceivedAt)
            .limit(limit)
            .offset(offset);

        if let Some(dt) = data_type {
            query = query.filter(device_realtime_data::Column::DataType.eq(dt));
        }

        query.all(&*self.db).await
    }
}
