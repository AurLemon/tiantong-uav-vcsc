use futures_util::{SinkExt, StreamExt, stream::SplitSink, stream::SplitStream};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, oneshot, RwLock, mpsc};
use tokio_tungstenite::{
    accept_async, connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream,
};
use tracing::{error, info, warn};

use uuid::Uuid;

use crate::services::mqtt_service::MqttService;
use crate::services::realtime_data::{RealtimeDataService, UnifiedRealtimeMessage};

/// 设备WebSocket代理信息
#[derive(Debug, Clone)]
pub struct DeviceProxyInfo {
    pub device_id: i32,
    pub device_uuid: Uuid,
    pub websocket_url: String,
    pub proxy_port: u16,
    pub is_connected: bool,
}

/// 代理服务器控制器
pub struct ProxyServerController {
    pub shutdown_tx: oneshot::Sender<()>,
}

/// 设备专用WebSocket代理服务
pub struct DeviceWebSocketProxyService {
    /// 设备代理信息
    device_proxies: Arc<RwLock<HashMap<i32, DeviceProxyInfo>>>,
    /// 设备WebSocket连接（服务器端接受的连接）
    device_server_connections: Arc<RwLock<HashMap<i32, WebSocketStream<TcpStream>>>>,
    /// 设备命令发送通道
    device_command_senders: Arc<RwLock<HashMap<i32, mpsc::UnboundedSender<String>>>>,
    /// 设备WebSocket连接（客户端连接到设备）
    device_client_connections: Arc<RwLock<HashMap<i32, WebSocketStream<MaybeTlsStream<TcpStream>>>>>,
    /// 前端客户端连接
    client_connections: Arc<RwLock<HashMap<i32, Vec<WebSocketStream<TcpStream>>>>>,
    /// 代理服务器控制器
    proxy_controllers: Arc<RwLock<HashMap<i32, ProxyServerController>>>,
    /// 实时数据服务
    realtime_service: Arc<RealtimeDataService>,
    /// MQTT服务
    mqtt_service: Arc<MqttService>,
    /// 统一消息广播接收器
    unified_receiver: broadcast::Receiver<UnifiedRealtimeMessage>,
}

impl DeviceWebSocketProxyService {
    pub fn new(
        realtime_service: Arc<RealtimeDataService>,
        mqtt_service: Arc<MqttService>,
        unified_receiver: broadcast::Receiver<UnifiedRealtimeMessage>,
    ) -> Self {
        Self {
            device_proxies: Arc::new(RwLock::new(HashMap::new())),
            device_server_connections: Arc::new(RwLock::new(HashMap::new())),
            device_command_senders: Arc::new(RwLock::new(HashMap::new())),
            device_client_connections: Arc::new(RwLock::new(HashMap::new())),
            client_connections: Arc::new(RwLock::new(HashMap::new())),
            proxy_controllers: Arc::new(RwLock::new(HashMap::new())),
            realtime_service,
            mqtt_service,
            unified_receiver,
        }
    }

    /// 为设备创建WebSocket代理
    pub async fn create_device_proxy(
        &self,
        device_id: i32,
        device_uuid: Uuid,
        device_port: u16,
    ) -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
        // 检查设备是否已经连接
        {
            let proxies = self.device_proxies.read().await;
            if let Some(existing_proxy) = proxies.get(&device_id) {
                if existing_proxy.is_connected {
                    return Ok(existing_proxy.proxy_port);
                }
            }
        }

        // 如果设备已存在但未连接，先断开旧连接
        self.disconnect_device(device_id).await;

        // 计算代理端口 (2333 + device_id)
        let proxy_port = 2333 + device_id as u16;

        let proxy_info = DeviceProxyInfo {
            device_id,
            device_uuid,
            websocket_url: format!("ws://localhost:{}", device_port),
            proxy_port,
            is_connected: false,
        };

        // 存储代理信息
        {
            let mut proxies = self.device_proxies.write().await;
            proxies.insert(device_id, proxy_info.clone());
        }

        // 为设备创建WebSocket服务器
        self.create_device_server(device_id, device_port).await?;

        // 启动代理服务器
        self.start_proxy_server(proxy_info).await?;

        Ok(proxy_port)
    }

    /// 启动代理服务器
    async fn start_proxy_server(
        &self,
        proxy_info: DeviceProxyInfo,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let addr = format!("127.0.0.1:{}", proxy_info.proxy_port);
        let listener = match TcpListener::bind(&addr).await {
            Ok(listener) => listener,
            Err(e) => {
                error!(
                    "Failed to bind proxy server for device {} on {}: {}",
                    proxy_info.device_id, addr, e
                );
                return Err(Box::new(e));
            }
        };

        info!(
            "Device {} WebSocket proxy listening on {}",
            proxy_info.device_id, addr
        );

        let device_id = proxy_info.device_id;
        let unified_receiver = self.unified_receiver.resubscribe();
        let device_command_senders = self.device_command_senders.clone();
        // 消息现在通过统一广播系统发送，无需单独的发送器

        // 创建关闭信号
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel();

        // 启动代理服务器任务
        let _proxy_handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, addr)) => {
                                info!("New client connected to device {} proxy from {}", device_id, addr);

                                match accept_async(stream).await {
                                    Ok(ws_stream) => {
                                        // 处理客户端连接
                                        let device_command_senders_clone = device_command_senders.clone();
                                        let unified_receiver_clone = unified_receiver.resubscribe();

                                        tokio::spawn(async move {
                                            if let Err(e) = handle_proxy_client_connection(
                                                ws_stream,
                                                device_id,
                                                device_command_senders_clone,
                                                unified_receiver_clone,
                                            ).await {
                                                error!("Error handling proxy client connection: {}", e);
                                            }
                                        });
                                    }
                                    Err(e) => {
                                        error!("Failed to accept WebSocket connection: {}", e);
                                    }
                                }
                            }
                            Err(e) => {
                                error!("Failed to accept connection: {}", e);
                            }
                        }
                    }
                    _ = &mut shutdown_rx => {
                        info!("Device {} proxy server shutdown signal received", device_id);
                        break;
                    }
                }
            }
            info!("Device {} proxy server stopped", device_id);
        });

        // 存储控制器
        {
            let mut controllers = self.proxy_controllers.write().await;
            controllers.insert(device_id, ProxyServerController { shutdown_tx });
        }

        Ok(())
    }

    /// 为设备创建WebSocket服务器
    async fn create_device_server(
        &self,
        device_id: i32,
        port: u16,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!(
            "Creating WebSocket server for device {} on port {}",
            device_id, port
        );

        let addr = format!("0.0.0.0:{}", port);
        let listener = match TcpListener::bind(&addr).await {
            Ok(listener) => listener,
            Err(e) => {
                error!(
                    "Failed to bind WebSocket server for device {} on {}: {}",
                    device_id, addr, e
                );
                return Err(Box::new(e));
            }
        };

        info!(
            "Device {} WebSocket server listening on {}",
            device_id, addr
        );

        // 启动设备服务器任务
        let device_connections = self.device_server_connections.clone();
        let device_command_senders = self.device_command_senders.clone();
        let realtime_service = self.realtime_service.clone();
        let device_proxies = self.device_proxies.clone();
        let mqtt_service = self.mqtt_service.clone();

        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        info!("Device {} connected from {}", device_id, addr);

                        // 处理设备WebSocket连接
                        let device_connections_clone = device_connections.clone();
                        let device_command_senders_clone = device_command_senders.clone();
                        let realtime_service_clone = realtime_service.clone();
                        // 消息通过统一广播系统发送
                        let device_proxies_clone = device_proxies.clone();

                        let mqtt_service_clone = mqtt_service.clone();
                        tokio::spawn(async move {
                            if let Err(e) = handle_device_server_connection(
                                stream,
                                device_id,
                                device_connections_clone,
                                device_command_senders_clone,
                                realtime_service_clone,
                                device_proxies_clone,
                                mqtt_service_clone,
                            )
                            .await
                            {
                                error!(
                                    "Error handling device {} server connection: {}",
                                    device_id, e
                                );
                            }
                        });
                    }
                    Err(e) => {
                        error!(
                            "Failed to accept connection for device {}: {}",
                            device_id, e
                        );
                    }
                }
            }
        });

        Ok(())
    }

    /// 连接到设备WebSocket (保留用于兼容性)
    async fn connect_to_device(
        &self,
        device_id: i32,
        websocket_url: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!(
            "Connecting to device {} WebSocket: {}",
            device_id, websocket_url
        );

        // 解析WebSocket URL
        let url = match url::Url::parse(websocket_url) {
            Ok(url) => url,
            Err(e) => {
                error!(
                    "Invalid WebSocket URL for device {}: {} - {}",
                    device_id, websocket_url, e
                );
                return Err(Box::new(e));
            }
        };

        // 使用超时来避免连接阻塞
        let ws_stream = match tokio::time::timeout(
            std::time::Duration::from_secs(10),
            connect_async(url),
        )
        .await
        {
            Ok(Ok(stream)) => stream,
            Ok(Err(e)) => {
                error!("Failed to connect to device {} WebSocket: {}", device_id, e);
                return Err(Box::new(e));
            }
            Err(_) => {
                error!("Timeout connecting to device {} WebSocket", device_id);
                return Err("Connection timeout".into());
            }
        };

        info!("Successfully connected to device {} WebSocket", device_id);

        // 存储连接
        {
            let mut connections = self.device_client_connections.write().await;
            connections.insert(device_id, ws_stream.0);
        }

        // 更新代理状态
        {
            let mut proxies = self.device_proxies.write().await;
            if let Some(proxy) = proxies.get_mut(&device_id) {
                proxy.is_connected = true;
                info!("Updated device {} proxy status to connected", device_id);
            }
        }

        // 启动消息处理循环
        self.start_device_message_loop(device_id).await;

        // 订阅MQTT消息
        self.subscribe_mqtt_messages(device_id).await;

        Ok(())
    }

    /// 启动设备消息处理循环
    async fn start_device_message_loop(&self, device_id: i32) {
        let device_connections = self.device_client_connections.clone();
        let realtime_service = self.realtime_service.clone();
        // 消息现在通过统一广播系统发送
        let device_proxies = self.device_proxies.clone();

        let _handle = tokio::spawn(async move {
            info!("Starting message loop for device {}", device_id);

            loop {
                // 先取出WebSocket连接，避免在等待消息时持有锁
                let mut ws_stream = {
                    let mut connections = device_connections.write().await;
                    match connections.remove(&device_id) {
                        Some(stream) => stream,
                        None => {
                            warn!("Device {} connection not found in message loop", device_id);
                            break;
                        }
                    }
                };

                // 在不持有锁的情况下等待下一个消息
                let message_result = ws_stream.next().await;

                match message_result {
                    Some(Ok(Message::Text(text))) => {
                        info!("Received from device {}: {}", device_id, text);

                        // 解析无人机数据并存储到数据库
                        if let Some(ws_msg) = crate::services::realtime_data::RealtimeDataService::parse_websocket_message(device_id, &text) {
                            if let Err(e) = realtime_service.process_websocket_message(ws_msg).await {
                                error!("Failed to process WebSocket message: {}", e);
                            }
                        }

                        // 消息现在通过RealtimeDataService处理并自动广播

                        // 重新存储连接以便下次使用
                        {
                            let mut connections = device_connections.write().await;
                            connections.insert(device_id, ws_stream);
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        info!("Device {} WebSocket connection closed", device_id);
                        break;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        info!("Received ping from device {}, sending pong", device_id);
                        // 发送pong响应
                        if let Err(e) = ws_stream.send(Message::Pong(data)).await {
                            error!("Failed to send pong to device {}: {}", device_id, e);
                            break;
                        }

                        // 重新存储连接
                        {
                            let mut connections = device_connections.write().await;
                            connections.insert(device_id, ws_stream);
                        }
                    }
                    Some(Ok(Message::Pong(_))) => {
                        info!("Received pong from device {}", device_id);

                        // 重新存储连接
                        {
                            let mut connections = device_connections.write().await;
                            connections.insert(device_id, ws_stream);
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        info!(
                            "Received binary data from device {} ({} bytes)",
                            device_id,
                            data.len()
                        );
                        // 可以根据需要处理二进制数据

                        // 重新存储连接
                        {
                            let mut connections = device_connections.write().await;
                            connections.insert(device_id, ws_stream);
                        }
                    }
                    Some(Ok(Message::Frame(_))) => {
                        // 处理原始帧消息，通常不需要特殊处理
                        info!("Received frame message from device {}", device_id);

                        // 重新存储连接
                        {
                            let mut connections = device_connections.write().await;
                            connections.insert(device_id, ws_stream);
                        }
                    }
                    Some(Err(e)) => {
                        error!("WebSocket error for device {}: {}", device_id, e);
                        break;
                    }
                    None => {
                        warn!("Device {} WebSocket stream ended", device_id);
                        break;
                    }
                }
            }

            // 消息循环结束时清理连接状态
            {
                let mut connections = device_connections.write().await;
                connections.remove(&device_id);
            }

            // 更新代理状态
            {
                let mut proxies = device_proxies.write().await;
                if let Some(proxy) = proxies.get_mut(&device_id) {
                    proxy.is_connected = false;
                }
            }

            info!(
                "Device {} message loop ended and connection cleaned up",
                device_id
            );
        });
    }

    /// 订阅MQTT消息
    async fn subscribe_mqtt_messages(&self, device_id: i32) {
        let mut mqtt_receiver = self.mqtt_service.get_message_sender().subscribe();
        // MQTT消息现在通过统一广播系统处理

        tokio::spawn(async move {
            while let Ok(mqtt_msg) = mqtt_receiver.recv().await {
                if mqtt_msg.device_id == device_id {
                    // MQTT消息现在通过统一广播系统自动处理
                }
            }
        });
    }

    /// 断开设备连接
    pub async fn disconnect_device(&self, device_id: i32) {
        info!("Disconnecting device {}", device_id);

        // 首先关闭命令发送器
        {
            let mut senders = self.device_command_senders.write().await;
            senders.remove(&device_id);
        }

        // 关闭WebSocket连接
        {
            let mut connections = self.device_server_connections.write().await;
            if let Some(mut ws_stream) = connections.remove(&device_id) {
                // 发送关闭消息
                let _ = ws_stream.send(Message::Close(None)).await;
                info!("WebSocket close message sent for device {}", device_id);
            }
        }

        // 发送代理服务器关闭信号
        {
            let mut controllers = self.proxy_controllers.write().await;
            if let Some(controller) = controllers.remove(&device_id) {
                let _ = controller.shutdown_tx.send(());
                info!("Proxy server shutdown signal sent for device {}", device_id);
            }
        }

        // 清理客户端连接
        {
            let mut clients = self.client_connections.write().await;
            if let Some(client_list) = clients.remove(&device_id) {
                info!(
                    "Removed {} client connections for device {}",
                    client_list.len(),
                    device_id
                );
            }
        }

        // 更新代理状态
        {
            let mut proxies = self.device_proxies.write().await;
            if let Some(proxy) = proxies.get_mut(&device_id) {
                proxy.is_connected = false;
                info!(
                    "Updated proxy status for device {} to disconnected",
                    device_id
                );
            }
        }

        info!("Device {} disconnected completely", device_id);
    }

    /// 获取设备代理信息
    pub async fn get_device_proxy(&self, device_id: i32) -> Option<DeviceProxyInfo> {
        let proxies = self.device_proxies.read().await;
        proxies.get(&device_id).cloned()
    }

    /// 检查设备是否已连接
    pub async fn is_device_connected(&self, device_id: i32) -> bool {
        let proxies = self.device_proxies.read().await;
        proxies.get(&device_id).map_or(false, |p| p.is_connected)
    }

    /// 向设备发送命令
    pub async fn send_device_command(
        &self,
        device_id: i32,
        command: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let senders = self.device_command_senders.read().await;
        if let Some(sender) = senders.get(&device_id) {
            sender.send(command.to_string())?;
            Ok(())
        } else {
            Err("Device not connected".into())
        }
    }
}

/// 处理设备服务器连接
async fn handle_device_server_connection(
    stream: TcpStream,
    device_id: i32,
    device_connections: Arc<RwLock<HashMap<i32, WebSocketStream<TcpStream>>>>,
    device_command_senders: Arc<RwLock<HashMap<i32, mpsc::UnboundedSender<String>>>>,
    realtime_service: Arc<RealtimeDataService>,
    device_proxies: Arc<RwLock<HashMap<i32, DeviceProxyInfo>>>,
    _mqtt_service: Arc<MqttService>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut ws_stream = accept_async(stream).await?;

    info!("Device {} WebSocket connection established", device_id);

    // 发送欢迎消息
    let welcome_msg = serde_json::json!({
        "type": "welcome",
        "device_id": device_id,
        "message": "Connected to UAV control system"
    });

    if let Err(e) = ws_stream.send(Message::Text(welcome_msg.to_string())).await {
        error!(
            "Failed to send welcome message to device {}: {}",
            device_id, e
        );
        return Err(Box::new(e));
    }

    // 创建命令通道
    let (command_tx, mut command_rx) = mpsc::unbounded_channel::<String>();

    // 存储命令发送器
    {
        let mut senders = device_command_senders.write().await;
        senders.insert(device_id, command_tx);
    }

    // 更新代理状态
    {
        let mut proxies = device_proxies.write().await;
        if let Some(proxy) = proxies.get_mut(&device_id) {
            proxy.is_connected = true;
            info!("Updated device {} proxy status to connected", device_id);
        }
    }

    // MQTT消息现在通过统一的广播系统处理，无需单独订阅

    // 分离WebSocket连接
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // 启动命令发送任务
    let command_task = tokio::spawn(async move {
        while let Some(command) = command_rx.recv().await {
            info!("Sending command to device {}: {}", device_id, command);
            if let Err(e) = ws_sender.send(Message::Text(command)).await {
                error!("Failed to send command to device {}: {}", device_id, e);
                break;
            }
        }
    });

    // 处理消息循环
    while let Some(msg) = ws_receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                info!("Received from device {}: {}", device_id, text);

                // 解析无人机数据并存储到数据库
                if let Some(ws_msg) = RealtimeDataService::parse_websocket_message(device_id, &text)
                {
                    if let Err(e) = realtime_service.process_websocket_message(ws_msg).await {
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

                // 消息现在通过RealtimeDataService处理并自动广播
            }
            Ok(Message::Close(_)) => {
                info!("Device {} WebSocket connection closed", device_id);
                break;
            }
            Ok(Message::Ping(_data)) => {
                // Ping处理现在由WebSocket库自动处理
                info!("Received ping from device {}", device_id);
            }
            Err(e) => {
                error!("WebSocket error for device {}: {}", device_id, e);
                break;
            }
            _ => {
                // 其他消息类型
            }
        }
    }

    // 停止命令发送任务
    command_task.abort();

    // 清理连接和命令发送器
    {
        let mut connections = device_connections.write().await;
        connections.remove(&device_id);
    }
    {
        let mut senders = device_command_senders.write().await;
        senders.remove(&device_id);
    }

    // 更新代理状态为断开
    {
        let mut proxies = device_proxies.write().await;
        if let Some(proxy) = proxies.get_mut(&device_id) {
            proxy.is_connected = false;
            info!("Updated device {} proxy status to disconnected", device_id);
        }
    }

    info!("Device {} WebSocket connection ended", device_id);
    Ok(())
}

/// 处理前端客户端连接
async fn handle_proxy_client_connection(
    ws_stream: WebSocketStream<TcpStream>,
    device_id: i32,
    device_command_senders: Arc<RwLock<HashMap<i32, mpsc::UnboundedSender<String>>>>,
    mut unified_receiver: broadcast::Receiver<UnifiedRealtimeMessage>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    info!("Frontend client connected to device {} proxy", device_id);

    // 启动消息转发任务（设备 -> 前端）
    let forward_task = tokio::spawn(async move {
        while let Ok(unified_msg) = unified_receiver.recv().await {
            if unified_msg.device_id == device_id {
                // 格式化消息
                let message = match unified_msg.message_type.as_str() {
                    "mqtt" => format!("mqtt:{}", unified_msg.data),
                    _ => unified_msg.data.to_string(),
                };

                // 直接发送给当前客户端
                if let Err(e) = ws_sender.send(Message::Text(message)).await {
                    error!("Failed to send message to frontend client: {}", e);
                    break;
                }
            }
        }
    });

    // 处理前端发来的命令
    while let Some(msg) = ws_receiver.next().await {
        match msg {
            Ok(Message::Text(command)) => {
                info!("Received command from frontend for device {}: {}", device_id, command);

                // 转发命令给设备
                {
                    let senders = device_command_senders.read().await;
                    if let Some(sender) = senders.get(&device_id) {
                        if let Err(e) = sender.send(command.clone()) {
                            error!("Failed to send command to device {}: {}", device_id, e);
                        } else {
                            info!("Command forwarded to device {}: {}", device_id, command);
                        }
                    } else {
                        warn!("Device {} not connected, cannot send command: {}", device_id, command);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                info!("Frontend client disconnected from device {} proxy", device_id);
                break;
            }
            Ok(Message::Ping(_data)) => {
                // Ping/Pong 由WebSocket库自动处理
                info!("Received ping from frontend client for device {}", device_id);
            }
            Err(e) => {
                error!("WebSocket error from frontend client: {}", e);
                break;
            }
            _ => {}
        }
    }

    // 清理任务
    forward_task.abort();

    info!("Frontend client connection to device {} proxy ended", device_id);
    Ok(())
}
