use std::sync::Arc;
use tokio::sync::OnceCell;

use crate::services::service_manager::ServiceManager;

/// 全局应用状态
pub struct AppState {
    pub service_manager: Arc<ServiceManager>,
}

impl AppState {
    pub fn new(service_manager: Arc<ServiceManager>) -> Self {
        Self { service_manager }
    }
}

/// 全局应用状态实例
static APP_STATE: OnceCell<Arc<AppState>> = OnceCell::const_new();

/// 初始化全局应用状态
pub async fn init_app_state(
    service_manager: Arc<ServiceManager>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let app_state = Arc::new(AppState::new(service_manager));

    APP_STATE
        .set(app_state)
        .map_err(|_| "Failed to initialize app state: already initialized")?;

    Ok(())
}

/// 获取全局应用状态
pub fn get_app_state() -> Option<Arc<AppState>> {
    APP_STATE.get().cloned()
}

/// 获取服务管理器
pub fn get_service_manager() -> Option<Arc<ServiceManager>> {
    get_app_state().map(|state| Arc::clone(&state.service_manager))
}
