use crate::middleware::rbac::{check_user_permission, get_user_roles};
use crate::models::{permission, role, role_permission, user, user_role};
use loco_rs::{hash, prelude::*};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, JoinType, QueryFilter, QuerySelect, RelationTrait,
    Set,
};
use serde::Serialize;
use uuid::Uuid;

// ============ 用户管理 ============
#[derive(Debug, Serialize)]
pub struct UserWithRoles {
    #[serde(flatten)]
    pub user: user::Model,
    pub roles: Vec<role::Model>,
}

/// 获取所有用户
async fn list_users(auth: auth::JWT, State(ctx): State<AppContext>) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "users.read").await? {
        return unauthorized("权限不足");
    }

    let users = user::Entity::find().all(&ctx.db).await?;
    let mut users_with_roles = Vec::new();

    for user_model in users {
        let roles = get_user_roles(&ctx.db, user_model.id).await?;
        users_with_roles.push(UserWithRoles {
            user: user_model,
            roles,
        });
    }

    format::json(users_with_roles)
}

/// 创建用户
async fn create_user(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<user::CreateUserParams>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "users.write").await? {
        return unauthorized("权限不足");
    }

    // 检查邮箱是否已存在
    let existing_user = user::Entity::find()
        .filter(user::Column::Email.eq(&params.email))
        .one(&ctx.db)
        .await?;

    if existing_user.is_some() {
        return bad_request("邮箱已被注册");
    }

    // 加密密码
    let password_hash = hash::hash_password(&params.password)?;

    // 创建用户
    let new_user = user::ActiveModel {
        pid: Set(Uuid::new_v4()),
        email: Set(params.email),
        password: Set(password_hash),
        api_key: Set(format!("ak-{}", Uuid::new_v4())),
        name: Set(params.name),
        ..Default::default()
    };

    let user_result = user::Entity::insert(new_user).exec(&ctx.db).await?;

    // 分配角色
    if let Some(role_ids) = params.role_ids {
        for role_id in role_ids {
            let new_user_role = user_role::ActiveModel {
                user_id: Set(user_result.last_insert_id),
                role_id: Set(role_id),
                ..Default::default()
            };
            user_role::Entity::insert(new_user_role)
                .exec(&ctx.db)
                .await?;
        }
    }

    let created_user = user::Entity::find_by_id(user_result.last_insert_id)
        .one(&ctx.db)
        .await?
        .ok_or_else(|| Error::string("用户创建失败"))?;

    format::json(created_user)
}

/// 更新用户
async fn update_user(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(user_id): Path<i32>,
    Json(params): Json<user::UpdateUserParams>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "users.write").await? {
        return unauthorized("权限不足");
    }

    let user_model = user::Entity::find_by_id(user_id)
        .one(&ctx.db)
        .await?
        .ok_or_else(|| Error::string("用户不存在"))?;

    let mut user_active: user::ActiveModel = user_model.into();

    if let Some(email) = params.email {
        user_active.email = Set(email);
    }
    if let Some(name) = params.name {
        user_active.name = Set(name);
    }
    if let Some(password) = params.password {
        let password_hash = hash::hash_password(&password)?;
        user_active.password = Set(password_hash);
    }

    let updated_user = user_active.update(&ctx.db).await?;
    format::json(updated_user)
}

/// 删除用户
async fn delete_user(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(user_id): Path<i32>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "users.delete").await? {
        return unauthorized("权限不足");
    }

    user::Entity::delete_by_id(user_id).exec(&ctx.db).await?;
    format::json(serde_json::json!({"message": "用户删除成功"}))
}

/// 为用户分配角色
async fn assign_user_roles(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(user_id): Path<i32>,
    Json(params): Json<user_role::BatchAssignRolesParams>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "users.write").await? {
        return unauthorized("权限不足");
    }

    // 删除现有角色
    user_role::Entity::delete_many()
        .filter(user_role::Column::UserId.eq(user_id))
        .exec(&ctx.db)
        .await?;

    // 分配新角色
    for role_id in params.role_ids {
        let new_user_role = user_role::ActiveModel {
            user_id: Set(user_id),
            role_id: Set(role_id),
            ..Default::default()
        };
        user_role::Entity::insert(new_user_role)
            .exec(&ctx.db)
            .await?;
    }

    format::json(serde_json::json!({"message": "角色分配成功"}))
}

// ============ 角色管理 ============

#[derive(Debug, Serialize)]
pub struct RoleWithPermissions {
    #[serde(flatten)]
    pub role: role::Model,
    pub permissions: Vec<permission::Model>,
}

/// 获取所有角色
async fn list_roles(State(ctx): State<AppContext>) -> Result<Response> {
    let roles = role::Entity::find().all(&ctx.db).await?;
    let mut roles_with_permissions = Vec::new();

    for role_model in roles {
        let permissions = permission::Entity::find()
            .join(
                JoinType::InnerJoin,
                permission::Relation::RolePermissions.def(),
            )
            .filter(role_permission::Column::RoleId.eq(role_model.id))
            .all(&ctx.db)
            .await?;

        roles_with_permissions.push(RoleWithPermissions {
            role: role_model,
            permissions,
        });
    }

    format::json(roles_with_permissions)
}

/// 创建角色
async fn create_role(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<role::CreateRoleParams>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "roles.write").await? {
        return unauthorized("权限不足");
    }

    let new_role = role::ActiveModel {
        name: Set(params.name),
        description: Set(params.description),
        is_active: Set(params.is_active.unwrap_or(true)),
        ..Default::default()
    };

    let created_role = role::Entity::insert(new_role)
        .exec_with_returning(&ctx.db)
        .await?;

    format::json(created_role)
}

/// 更新角色
async fn update_role(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(role_id): Path<i32>,
    Json(params): Json<role::UpdateRoleParams>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "roles.write").await? {
        return unauthorized("权限不足");
    }

    let role_model = role::Entity::find_by_id(role_id)
        .one(&ctx.db)
        .await?
        .ok_or_else(|| Error::string("角色不存在"))?;

    let mut role_active: role::ActiveModel = role_model.into();

    if let Some(name) = params.name {
        role_active.name = Set(name);
    }
    if let Some(description) = params.description {
        role_active.description = Set(Some(description));
    }
    if let Some(is_active) = params.is_active {
        role_active.is_active = Set(is_active);
    }

    let updated_role = role_active.update(&ctx.db).await?;
    format::json(updated_role)
}

/// 删除角色
async fn delete_role(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(role_id): Path<i32>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "roles.delete").await? {
        return unauthorized("权限不足");
    }

    role::Entity::delete_by_id(role_id).exec(&ctx.db).await?;
    format::json(serde_json::json!({"message": "角色删除成功"}))
}

/// 为角色分配权限
async fn assign_role_permissions(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Path(role_id): Path<i32>,
    Json(params): Json<role_permission::BatchAssignPermissionsParams>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "permissions.assign").await? {
        return unauthorized("权限不足");
    }

    // 删除现有权限
    role_permission::Entity::delete_many()
        .filter(role_permission::Column::RoleId.eq(role_id))
        .exec(&ctx.db)
        .await?;

    // 分配新权限
    for permission_id in params.permission_ids {
        let new_role_permission = role_permission::ActiveModel {
            role_id: Set(role_id),
            permission_id: Set(permission_id),
            ..Default::default()
        };
        role_permission::Entity::insert(new_role_permission)
            .exec(&ctx.db)
            .await?;
    }

    format::json(serde_json::json!({"message": "权限分配成功"}))
}

// ============ 权限管理 ============

/// 获取所有权限
async fn list_permissions(State(ctx): State<AppContext>) -> Result<Response> {
    let permissions = permission::Entity::find().all(&ctx.db).await?;
    format::json(permissions)
}

/// 创建权限
async fn create_permission(
    auth: auth::JWT,
    State(ctx): State<AppContext>,
    Json(params): Json<permission::CreatePermissionParams>,
) -> Result<Response> {
    // 检查权限
    if !check_user_permission(&ctx.db, &auth.claims.pid, "permissions.write").await? {
        return unauthorized("权限不足");
    }

    let new_permission = permission::ActiveModel {
        name: Set(params.name),
        description: Set(params.description),
        resource: Set(params.resource),
        action: Set(params.action),
        ..Default::default()
    };

    let created_permission = permission::Entity::insert(new_permission)
        .exec_with_returning(&ctx.db)
        .await?;

    format::json(created_permission)
}

pub fn routes() -> Routes {
    Routes::new()
        // 用户管理路由
        .add("/users", get(list_users))
        .add("/users", post(create_user))
        .add("/users/{user_id}", put(update_user))
        .add("/users/{user_id}", delete(delete_user))
        .add("/users/{user_id}/roles", post(assign_user_roles))
        // 角色管理路由
        .add("/roles", get(list_roles))
        .add("/roles", post(create_role))
        .add("/roles/{role_id}", put(update_role))
        .add("/roles/{role_id}", delete(delete_role))
        .add(
            "/roles/{role_id}/permissions",
            post(assign_role_permissions),
        )
        // 权限管理路由
        .add("/permissions", get(list_permissions))
        .add("/permissions", post(create_permission))
}
