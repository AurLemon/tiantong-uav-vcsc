use crate::models::{permission, role, role_permission, user, user_role};
use loco_rs::prelude::*;
use sea_orm::{ColumnTrait, EntityTrait, JoinType, QueryFilter, QuerySelect, RelationTrait};
use std::collections::HashSet;

/// RBAC权限检查中间件
///
/// 使用方法：
/// ```rust
/// use crate::middleware::rbac::check_user_permission;
///
/// async fn protected_handler(
///     auth: auth::JWT,
///     State(ctx): State<AppContext>,
/// ) -> Result<Response> {
///     // 检查权限
///     if !check_user_permission(&ctx.db, &auth.claims.pid, "users.read").await? {
///         return unauthorized("权限不足");
///     }
///     // 处理逻辑
/// }
/// ```

/// 检查用户是否具有指定权限
pub async fn check_user_permission(
    db: &DatabaseConnection,
    user_email: &str,
    required_permission: &str,
) -> Result<bool> {
    // 查找用户
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(user_email))
        .one(db)
        .await?;

    let Some(user_model) = user_entity else {
        return Ok(false);
    };

    // 获取用户的所有权限
    let user_permissions = get_user_permissions(db, user_model.id).await?;

    // 检查是否具有所需权限或通配符权限
    Ok(user_permissions.contains(required_permission) || user_permissions.contains("*"))
}

/// 获取用户的所有权限
pub async fn get_user_permissions(
    db: &DatabaseConnection,
    user_id: i32,
) -> Result<HashSet<String>> {
    let mut permissions = HashSet::new();

    // 通过用户角色获取权限
    let user_permissions = permission::Entity::find()
        .join(
            JoinType::InnerJoin,
            permission::Relation::RolePermissions.def(),
        )
        .join(JoinType::InnerJoin, role_permission::Relation::Role.def())
        .join(JoinType::InnerJoin, role::Relation::UserRoles.def())
        .filter(user_role::Column::UserId.eq(user_id))
        .filter(role::Column::IsActive.eq(true))
        .all(db)
        .await?;

    for permission in user_permissions {
        permissions.insert(permission.name);
    }

    Ok(permissions)
}

/// 获取用户的所有角色
pub async fn get_user_roles(db: &DatabaseConnection, user_id: i32) -> Result<Vec<role::Model>> {
    role::Entity::find()
        .join(JoinType::InnerJoin, role::Relation::UserRoles.def())
        .filter(user_role::Column::UserId.eq(user_id))
        .filter(role::Column::IsActive.eq(true))
        .all(db)
        .await
        .map_err(|e| Error::DB(e))
}

/// 权限检查宏，用于在handler中快速检查权限
#[macro_export]
macro_rules! check_permission {
    ($db:expr, $user_email:expr, $permission:expr) => {
        if !crate::middleware::rbac::check_user_permission($db, $user_email, $permission).await? {
            return unauthorized("权限不足");
        }
    };
}

/// 管理员权限检查
pub async fn check_admin_permission(db: &DatabaseConnection, user_email: &str) -> Result<bool> {
    check_user_permission(db, user_email, "*").await
}

/// 检查用户是否具有管理员角色
pub async fn is_admin(db: &DatabaseConnection, user_email: &str) -> Result<bool> {
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(user_email))
        .one(db)
        .await?;

    let Some(user_model) = user_entity else {
        return Ok(false);
    };

    let admin_role = role::Entity::find()
        .join(JoinType::InnerJoin, role::Relation::UserRoles.def())
        .filter(user_role::Column::UserId.eq(user_model.id))
        .filter(role::Column::Name.eq("admin"))
        .filter(role::Column::IsActive.eq(true))
        .one(db)
        .await?;

    Ok(admin_role.is_some())
}
