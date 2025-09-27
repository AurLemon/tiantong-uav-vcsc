use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "role")]
pub struct Model {
    pub created_at: DateTime,
    pub updated_at: DateTime,
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::user_role::Entity")]
    UserRoles,
    #[sea_orm(has_many = "super::role_permission::Entity")]
    RolePermissions,
}

impl Related<super::user_role::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::UserRoles.def()
    }
}

impl Related<super::role_permission::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RolePermissions.def()
    }
}

// 通过用户角色关联表关联用户
impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        super::user_role::Relation::User.def()
    }
    fn via() -> Option<RelationDef> {
        Some(super::user_role::Relation::Role.def().rev())
    }
}

// 通过角色权限关联表关联权限
impl Related<super::permission::Entity> for Entity {
    fn to() -> RelationDef {
        super::role_permission::Relation::Permission.def()
    }
    fn via() -> Option<RelationDef> {
        Some(super::role_permission::Relation::Role.def().rev())
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelatedEntity)]
pub enum RelatedEntity {
    #[sea_orm(entity = "super::user_role::Entity")]
    UserRoles,
    #[sea_orm(entity = "super::role_permission::Entity")]
    RolePermissions,
    #[sea_orm(entity = "super::user::Entity")]
    Users,
    #[sea_orm(entity = "super::permission::Entity")]
    Permissions,
}

// 角色创建参数
#[derive(Debug, Deserialize)]
pub struct CreateRoleParams {
    pub name: String,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

// 角色更新参数
#[derive(Debug, Deserialize)]
pub struct UpdateRoleParams {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}
