use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Deserialize, Serialize)]
#[sea_orm(table_name = "user")]
pub struct Model {
    pub created_at: DateTime,
    pub updated_at: DateTime,
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub pid: Uuid,
    #[sea_orm(unique)]
    pub email: String,
    pub password: String,
    #[sea_orm(unique)]
    pub api_key: String,
    pub name: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::device::Entity")]
    Devices,
    #[sea_orm(has_many = "super::task::Entity")]
    Tasks,
    #[sea_orm(has_many = "super::user_role::Entity")]
    UserRoles,
}

impl Related<super::device::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Devices.def()
    }
}

impl Related<super::task::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Tasks.def()
    }
}

impl Related<super::user_role::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::UserRoles.def()
    }
}

// 通过用户角色关联表关联角色
impl Related<super::role::Entity> for Entity {
    fn to() -> RelationDef {
        super::user_role::Relation::Role.def()
    }
    fn via() -> Option<RelationDef> {
        Some(super::user_role::Relation::User.def().rev())
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelatedEntity)]
pub enum RelatedEntity {
    #[sea_orm(entity = "super::device::Entity")]
    Devices,
    #[sea_orm(entity = "super::task::Entity")]
    Tasks,
    #[sea_orm(entity = "super::user_role::Entity")]
    UserRoles,
    #[sea_orm(entity = "super::role::Entity")]
    Roles,
}

// 用户注册参数
#[derive(Debug, Deserialize)]
pub struct RegisterUserParams {
    pub email: String,
    pub password: String,
    pub name: String,
}

// 用户创建参数（管理员用）
#[derive(Debug, Deserialize)]
pub struct CreateUserParams {
    pub email: String,
    pub password: String,
    pub name: String,
    pub role_ids: Option<Vec<i32>>,
}

// 用户更新参数
#[derive(Debug, Deserialize)]
pub struct UpdateUserParams {
    pub email: Option<String>,
    pub name: Option<String>,
    pub password: Option<String>,
}
