use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "permission")]
pub struct Model {
    pub created_at: DateTime,
    pub updated_at: DateTime,
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub name: String,
    pub description: Option<String>,
    pub resource: Option<String>,
    pub action: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::role_permission::Entity")]
    RolePermissions,
}

impl Related<super::role_permission::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RolePermissions.def()
    }
}

// 通过角色权限关联表关联角色
impl Related<super::role::Entity> for Entity {
    fn to() -> RelationDef {
        super::role_permission::Relation::Role.def()
    }
    fn via() -> Option<RelationDef> {
        Some(super::role_permission::Relation::Permission.def().rev())
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelatedEntity)]
pub enum RelatedEntity {
    #[sea_orm(entity = "super::role_permission::Entity")]
    RolePermissions,
    #[sea_orm(entity = "super::role::Entity")]
    Roles,
}

// 权限创建参数
#[derive(Debug, Deserialize)]
pub struct CreatePermissionParams {
    pub name: String,
    pub description: Option<String>,
    pub resource: Option<String>,
    pub action: Option<String>,
}

// 权限更新参数
#[derive(Debug, Deserialize)]
pub struct UpdatePermissionParams {
    pub name: Option<String>,
    pub description: Option<String>,
    pub resource: Option<String>,
    pub action: Option<String>,
}
