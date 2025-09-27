use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "task")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub uuid: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub task_type: String, // manual, auto, scheduled
    pub status: String,    // pending, running, completed, failed, cancelled
    pub device_id: i32,
    pub user_id: i32,
    pub parameters: Option<Json>, // 任务参数
    pub start_time: Option<DateTimeWithTimeZone>,
    pub end_time: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::device::Entity",
        from = "Column::DeviceId",
        to = "super::device::Column::Id"
    )]
    Device,
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::UserId",
        to = "super::user::Column::Id"
    )]
    User,
}

impl Related<super::device::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Device.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelatedEntity)]
pub enum RelatedEntity {
    #[sea_orm(entity = "super::device::Entity")]
    Device,
    #[sea_orm(entity = "super::user::Entity")]
    User,
}

// 任务状态枚举
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl ToString for TaskStatus {
    fn to_string(&self) -> String {
        match self {
            TaskStatus::Pending => "pending".to_string(),
            TaskStatus::Running => "running".to_string(),
            TaskStatus::Completed => "completed".to_string(),
            TaskStatus::Failed => "failed".to_string(),
            TaskStatus::Cancelled => "cancelled".to_string(),
        }
    }
}

impl From<String> for TaskStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "pending" => TaskStatus::Pending,
            "running" => TaskStatus::Running,
            "completed" => TaskStatus::Completed,
            "failed" => TaskStatus::Failed,
            "cancelled" => TaskStatus::Cancelled,
            _ => TaskStatus::Pending,
        }
    }
}

// 任务类型枚举
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskType {
    Manual,    // 手动任务
    Auto,      // 自动任务
    Scheduled, // 定时任务
}

impl ToString for TaskType {
    fn to_string(&self) -> String {
        match self {
            TaskType::Manual => "manual".to_string(),
            TaskType::Auto => "auto".to_string(),
            TaskType::Scheduled => "scheduled".to_string(),
        }
    }
}

impl From<String> for TaskType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "manual" => TaskType::Manual,
            "auto" => TaskType::Auto,
            "scheduled" => TaskType::Scheduled,
            _ => TaskType::Manual,
        }
    }
}

// 任务参数结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskParameters {
    pub steps: Vec<TaskStep>,
    pub timeout: Option<u32>,     // 超时时间（秒）
    pub retry_count: Option<u32>, // 重试次数
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskStep {
    pub step_type: String, // takeoff, landing, move_to_height, move_to_heading, wait, photo
    pub parameters: serde_json::Value,
    pub timeout: Option<u32>,
}

// 预定义任务模板
impl TaskParameters {
    /// 创建一键任务参数
    pub fn one_click_task() -> Self {
        Self {
            steps: vec![
                TaskStep {
                    step_type: "takeoff".to_string(),
                    parameters: serde_json::json!({}),
                    timeout: Some(30),
                },
                TaskStep {
                    step_type: "wait".to_string(),
                    parameters: serde_json::json!({"duration": 10}),
                    timeout: None,
                },
                TaskStep {
                    step_type: "move_to_heading".to_string(),
                    parameters: serde_json::json!({"heading": 0}),
                    timeout: Some(30),
                },
                TaskStep {
                    step_type: "wait".to_string(),
                    parameters: serde_json::json!({"duration": 10}),
                    timeout: None,
                },
                TaskStep {
                    step_type: "move_to_height".to_string(),
                    parameters: serde_json::json!({"height": 1.5}),
                    timeout: Some(30),
                },
                TaskStep {
                    step_type: "wait".to_string(),
                    parameters: serde_json::json!({"duration": 10}),
                    timeout: None,
                },
                TaskStep {
                    step_type: "move_to_height".to_string(),
                    parameters: serde_json::json!({"height": 2.0}),
                    timeout: Some(30),
                },
                TaskStep {
                    step_type: "move_to_heading".to_string(),
                    parameters: serde_json::json!({"heading": 0}),
                    timeout: Some(30),
                },
                TaskStep {
                    step_type: "wait".to_string(),
                    parameters: serde_json::json!({"duration": 10}),
                    timeout: None,
                },
                TaskStep {
                    step_type: "landing".to_string(),
                    parameters: serde_json::json!({}),
                    timeout: Some(60),
                },
            ],
            timeout: Some(300), // 5分钟总超时
            retry_count: Some(1),
        }
    }
}
