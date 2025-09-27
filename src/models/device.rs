use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "device")]
pub struct Model {
    pub created_at: DateTime,
    pub updated_at: DateTime,
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub uuid: Uuid,
    pub name: String,
    pub websocket_port: Option<i32>,
    pub easynvr_url: Option<String>,
    pub http_api_url: Option<String>,
    pub description: Option<String>,
    pub drone_model: Option<String>,
    pub drone_brand: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub user_id: i32,
    pub mqtt_port: Option<i32>,
    pub mqtt_enabled: bool,
    pub is_connected: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::UserId",
        to = "super::user::Column::Id"
    )]
    User,
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelatedEntity)]
pub enum RelatedEntity {
    #[sea_orm(entity = "super::user::Entity")]
    User,
}

// 设备创建参数
#[derive(Debug, Deserialize)]
pub struct CreateDeviceParams {
    pub name: String,
    pub websocket_port: Option<i32>,
    pub easynvr_url: Option<String>,
    pub http_api_url: Option<String>,
    pub description: Option<String>,
    pub drone_model: Option<String>,
    pub drone_brand: Option<String>,
    pub mqtt_port: Option<i32>,
    pub mqtt_enabled: Option<bool>,
}

// 设备更新参数
#[derive(Debug, Deserialize)]
pub struct UpdateDeviceParams {
    pub name: Option<String>,
    pub websocket_port: Option<i32>,
    pub easynvr_url: Option<String>,
    pub http_api_url: Option<String>,
    pub description: Option<String>,
    pub drone_model: Option<String>,
    pub drone_brand: Option<String>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
    pub mqtt_port: Option<i32>,
    pub mqtt_enabled: Option<bool>,
    pub is_connected: Option<bool>,
}

// 设备响应
#[derive(Debug, Serialize)]
pub struct DeviceResponse {
    pub id: i32,
    pub uuid: Uuid,
    pub name: String,
    pub websocket_port: Option<i32>,
    pub easynvr_url: Option<String>,
    pub http_api_url: Option<String>,
    pub description: Option<String>,
    pub drone_model: Option<String>,
    pub drone_brand: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
    pub mqtt_port: Option<i32>,
    pub mqtt_enabled: bool,
    pub is_connected: bool,
}

impl From<Model> for DeviceResponse {
    fn from(device: Model) -> Self {
        Self {
            id: device.id,
            uuid: device.uuid,
            name: device.name,
            websocket_port: device.websocket_port,
            easynvr_url: device.easynvr_url,
            http_api_url: device.http_api_url,
            description: device.description,
            drone_model: device.drone_model,
            drone_brand: device.drone_brand,
            is_default: device.is_default,
            is_active: device.is_active,
            created_at: device.created_at,
            updated_at: device.updated_at,
            mqtt_port: device.mqtt_port,
            mqtt_enabled: device.mqtt_enabled,
            is_connected: device.is_connected,
        }
    }
}

impl Model {
    /// 验证设备连接
    pub async fn validate_connection(&self) -> Result<bool, String> {
        // 验证端口号
        if let Some(port) = self.websocket_port {
            if port < 1 || port > 65535 {
                return Err("Invalid WebSocket port: must be between 1 and 65535".to_string());
            }
        } else {
            return Err("WebSocket port is required".to_string());
        }

        // 这里可以添加更复杂的连接验证逻辑
        // 目前只做基本的端口范围检查
        Ok(true)
    }
}
