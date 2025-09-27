use crate::models::{device, task, user};
use axum::Json;
use loco_rs::controller::middleware::auth::JWT;
use loco_rs::prelude::*;
use sea_orm::QueryOrder;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateTaskParams {
    pub name: String,
    pub description: Option<String>,
    pub task_type: String,
    pub device_id: i32,
    pub parameters: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateTaskParams {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub parameters: Option<serde_json::Value>,
    pub start_time: Option<DateTimeWithTimeZone>,
    pub end_time: Option<DateTimeWithTimeZone>,
}

#[derive(Debug, Serialize)]
pub struct TaskResponse {
    pub id: i32,
    pub uuid: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub task_type: String,
    pub status: String,
    pub device_id: i32,
    pub user_id: i32,
    pub parameters: Option<serde_json::Value>,
    pub start_time: Option<DateTimeWithTimeZone>,
    pub end_time: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
    pub device_name: Option<String>,
}

impl From<(task::Model, Option<device::Model>)> for TaskResponse {
    fn from((task, device): (task::Model, Option<device::Model>)) -> Self {
        Self {
            id: task.id,
            uuid: task.uuid,
            name: task.name,
            description: task.description,
            task_type: task.task_type,
            status: task.status,
            device_id: task.device_id,
            user_id: task.user_id,
            parameters: task.parameters,
            start_time: task.start_time,
            end_time: task.end_time,
            created_at: task.created_at,
            updated_at: task.updated_at,
            device_name: device.map(|d| d.name),
        }
    }
}

/// 获取任务列表
pub async fn list(auth: JWT, State(ctx): State<AppContext>) -> Result<Response> {
    // 查找用户 (JWT中的pid实际上是email)
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user) = user else {
        return unauthorized("用户未找到");
    };

    let tasks = task::Entity::find()
        .filter(task::Column::UserId.eq(user.id))
        .find_also_related(device::Entity)
        .order_by_desc(task::Column::CreatedAt)
        .all(&ctx.db)
        .await?;

    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();

    format::json(task_responses)
}

/// 创建任务
pub async fn create(
    auth: JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<CreateTaskParams>,
) -> Result<Response> {
    // 查找用户 (JWT中的pid实际上是email)
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user) = user else {
        return unauthorized("用户未找到");
    };

    // 验证设备是否属于该用户
    let device = device::Entity::find()
        .filter(device::Column::Id.eq(params.device_id))
        .filter(device::Column::UserId.eq(user.id))
        .one(&ctx.db)
        .await?;

    let Some(device) = device else {
        return bad_request("设备未找到或无权限");
    };

    let task_model = task::ActiveModel {
        uuid: Set(Uuid::new_v4()),
        name: Set(params.name),
        description: Set(params.description),
        task_type: Set(params.task_type),
        status: Set("pending".to_string()),
        device_id: Set(params.device_id),
        user_id: Set(user.id),
        parameters: Set(params.parameters),
        ..Default::default()
    };

    let task = task::Entity::insert(task_model)
        .exec_with_returning(&ctx.db)
        .await?;

    let response = TaskResponse::from((task, Some(device)));
    format::json(response)
}

/// 获取单个任务
pub async fn get_one(
    auth: JWT,
    Path(task_uuid): Path<Uuid>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 查找用户 (JWT中的pid实际上是email)
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user) = user else {
        return unauthorized("用户未找到");
    };

    let task_with_device = task::Entity::find()
        .filter(task::Column::Uuid.eq(task_uuid))
        .filter(task::Column::UserId.eq(user.id))
        .find_also_related(device::Entity)
        .one(&ctx.db)
        .await?;

    let Some((task, device)) = task_with_device else {
        return not_found();
    };

    let response = TaskResponse::from((task, device));
    format::json(response)
}

/// 更新任务
pub async fn update(
    auth: JWT,
    Path(task_uuid): Path<Uuid>,
    State(ctx): State<AppContext>,
    Json(params): Json<UpdateTaskParams>,
) -> Result<Response> {
    // 查找用户 (JWT中的pid实际上是email)
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user) = user else {
        return unauthorized("用户未找到");
    };

    let task = task::Entity::find()
        .filter(task::Column::Uuid.eq(task_uuid))
        .filter(task::Column::UserId.eq(user.id))
        .one(&ctx.db)
        .await?;

    let Some(task) = task else {
        return not_found();
    };

    let mut task_active: task::ActiveModel = task.into();

    if let Some(name) = params.name {
        task_active.name = Set(name);
    }
    if let Some(description) = params.description {
        task_active.description = Set(Some(description));
    }
    if let Some(status) = params.status {
        task_active.status = Set(status);
    }
    if let Some(parameters) = params.parameters {
        task_active.parameters = Set(Some(parameters));
    }
    if let Some(start_time) = params.start_time {
        task_active.start_time = Set(Some(start_time));
    }
    if let Some(end_time) = params.end_time {
        task_active.end_time = Set(Some(end_time));
    }

    task_active.updated_at = Set(chrono::Utc::now().into());

    let updated_task = task_active.update(&ctx.db).await?;

    // 获取关联的设备信息
    let device = device::Entity::find()
        .filter(device::Column::Id.eq(updated_task.device_id))
        .one(&ctx.db)
        .await?;

    let response = TaskResponse::from((updated_task, device));
    format::json(response)
}

/// 删除任务
pub async fn delete_task(
    auth: JWT,
    Path(task_uuid): Path<Uuid>,
    State(ctx): State<AppContext>,
) -> Result<Response> {
    // 查找用户 (JWT中的pid实际上是email)
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user) = user else {
        return unauthorized("用户未找到");
    };

    let task = task::Entity::find()
        .filter(task::Column::Uuid.eq(task_uuid))
        .filter(task::Column::UserId.eq(user.id))
        .one(&ctx.db)
        .await?;

    let Some(task) = task else {
        return not_found();
    };

    task::Entity::delete_by_id(task.id).exec(&ctx.db).await?;

    format::json(serde_json::json!({
        "message": "任务删除成功"
    }))
}

/// 创建一键任务
pub async fn create_one_click_task(
    auth: JWT,
    State(ctx): State<AppContext>,
    Json(device_id): Json<serde_json::Value>,
) -> Result<Response> {
    let device_id: i32 = device_id
        .get("device_id")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .ok_or_else(|| Error::BadRequest("device_id is required".to_string()))?;

    // 查找用户 (JWT中的pid实际上是email)
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user) = user else {
        return unauthorized("用户未找到");
    };

    // 验证设备是否属于该用户
    let device = device::Entity::find()
        .filter(device::Column::Id.eq(device_id))
        .filter(device::Column::UserId.eq(user.id))
        .one(&ctx.db)
        .await?;

    let Some(device) = device else {
        return bad_request("设备未找到或无权限");
    };

    let one_click_params = task::TaskParameters::one_click_task();

    let task_model = task::ActiveModel {
        uuid: Set(Uuid::new_v4()),
        name: Set("一键任务".to_string()),
        description: Set(Some(
            "起飞-悬停-朝北-静止10秒-飞到1.5米-悬停-朝北-静止10秒-飞到2米-悬停-朝北-静止10秒-降落"
                .to_string(),
        )),
        task_type: Set("auto".to_string()),
        status: Set("pending".to_string()),
        device_id: Set(device_id),
        user_id: Set(user.id),
        parameters: Set(Some(serde_json::to_value(one_click_params).unwrap())),
        ..Default::default()
    };

    let task = task::Entity::insert(task_model)
        .exec_with_returning(&ctx.db)
        .await?;

    let response = TaskResponse::from((task, Some(device)));
    format::json(response)
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("tasks")
        .add("/", get(list))
        .add("/", post(create))
        .add("/one-click", post(create_one_click_task))
        .add("/{task_uuid}", get(get_one))
        .add("/{task_uuid}", put(update))
        .add("/{task_uuid}", delete(delete_task))
}
