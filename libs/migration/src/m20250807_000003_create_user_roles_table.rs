use super::m20250101_000001_user::User;
use super::m20250807_000001_create_roles_table::Role;
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let table = Table::create()
            .table(UserRole::Table)
            .col(date_time(UserRole::CreatedAt).default(Expr::current_timestamp()))
            .col(date_time(UserRole::UpdatedAt).default(Expr::current_timestamp()))
            .col(pk_auto(UserRole::Id))
            .col(integer(UserRole::UserId))
            .col(integer(UserRole::RoleId))
            .foreign_key(
                ForeignKey::create()
                    .name("fk_user_role_user_id")
                    .from(UserRole::Table, UserRole::UserId)
                    .to(User::Table, User::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .foreign_key(
                ForeignKey::create()
                    .name("fk_user_role_role_id")
                    .from(UserRole::Table, UserRole::RoleId)
                    .to(Role::Table, Role::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .to_owned();
        manager.create_table(table).await?;

        // 创建唯一索引确保用户角色组合唯一
        let unique_index = Index::create()
            .name("idx_user_role_unique")
            .table(UserRole::Table)
            .col(UserRole::UserId)
            .col(UserRole::RoleId)
            .unique()
            .to_owned();
        manager.create_index(unique_index).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(UserRole::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
pub enum UserRole {
    Table,
    CreatedAt,
    UpdatedAt,
    Id,
    UserId,
    RoleId,
}
