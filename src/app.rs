use std::path::Path;

use async_trait::async_trait;
use loco_rs::{
    app::{AppContext, Hooks},
    bgworker::Queue,
    boot::{create_app, BootResult, StartMode},
    config::Config,
    controller::AppRoutes,
    environment::Environment,
    task::Tasks,
    Result,
};
use migration::Migrator;

use crate::{controllers, services, tasks};

pub struct App;
#[async_trait]
impl Hooks for App {
    fn app_name() -> &'static str {
        env!("CARGO_CRATE_NAME")
    }

    fn app_version() -> String {
        format!(
            "{} ({})",
            env!("CARGO_PKG_VERSION"),
            option_env!("BUILD_SHA")
                .or(option_env!("GITHUB_SHA"))
                .unwrap_or("dev")
        )
    }

    async fn boot(
        mode: StartMode,
        environment: &Environment,
        config: Config,
    ) -> Result<BootResult> {
        create_app::<Self, Migrator>(mode, environment, config).await
    }

    fn routes(_ctx: &AppContext) -> AppRoutes {
        AppRoutes::with_default_routes()
            .prefix("/api")
            .add_route(controllers::auth::routes())
            .add_route(controllers::user::routes())
            .add_route(controllers::device::routes())
            .add_route(controllers::task::routes())
            .add_route(controllers::admin::routes())
            .add_route(controllers::rbac::routes())
            .add_route(controllers::graphql::routes())
            .add_route(controllers::collection_data::routes())
            .add_route(controllers::weather_condition::routes())
            .add_route(controllers::prediction::routes())
            .add_route(controllers::warn::routes())
            .add_route(controllers::upload::routes())
            .add_route(controllers::element_type::routes())
            .add_route(controllers::realtime::routes())
    }

    async fn connect_workers(_ctx: &AppContext, _queue: &Queue) -> Result<()> {
        Ok(())
    }

    async fn after_routes(router: axum::Router, ctx: &AppContext) -> Result<axum::Router> {
        // 初始化服务管理器
        let db = std::sync::Arc::new(ctx.db.clone());
        let service_manager =
            std::sync::Arc::new(services::service_manager::ServiceManager::new(db).await);

        // 启动所有服务
        if let Err(e) = service_manager.start().await {
            tracing::error!("Failed to start service manager: {}", e);
        } else {
            tracing::info!("Service manager started successfully");
        }

        // 初始化全局应用状态
        if let Err(e) = services::app_state::init_app_state(service_manager).await {
            tracing::error!("Failed to initialize app state: {}", e);
        } else {
            tracing::info!("App state initialized successfully");
        }

        Ok(router)
    }

    fn register_tasks(tasks: &mut Tasks) {
        tasks.register(tasks::seed::SeedData);
    }

    async fn truncate(_ctx: &AppContext) -> Result<()> {
        Ok(())
    }

    async fn seed(_ctx: &AppContext, _base: &Path) -> Result<()> {
        Ok(())
    }
}
