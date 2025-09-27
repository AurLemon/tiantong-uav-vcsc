use super::m20250807_000001_create_roles_table::Role;
use super::m20250807_000002_create_permissions_table::Permission;
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let table = Table::create()
            .table(RolePermission::Table)
            .col(date_time(RolePermission::CreatedAt).default(Expr::current_timestamp()))
            .col(date_time(RolePermission::UpdatedAt).default(Expr::current_timestamp()))
            .col(pk_auto(RolePermission::Id))
            .col(integer(RolePermission::RoleId))
            .col(integer(RolePermission::PermissionId))
            .foreign_key(
                ForeignKey::create()
                    .name("fk_role_permission_role_id")
                    .from(RolePermission::Table, RolePermission::RoleId)
                    .to(Role::Table, Role::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .foreign_key(
                ForeignKey::create()
                    .name("fk_role_permission_permission_id")
                    .from(RolePermission::Table, RolePermission::PermissionId)
                    .to(Permission::Table, Permission::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .to_owned();
        manager.create_table(table).await?;

        // 创建唯一索引确保角色权限组合唯一
        let unique_index = Index::create()
            .name("idx_role_permission_unique")
            .table(RolePermission::Table)
            .col(RolePermission::RoleId)
            .col(RolePermission::PermissionId)
            .unique()
            .to_owned();
        manager.create_index(unique_index).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(RolePermission::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
pub enum RolePermission {
    Table,
    CreatedAt,
    UpdatedAt,
    Id,
    RoleId,
    PermissionId,
}
