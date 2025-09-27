use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let table = Table::create()
            .table(Permission::Table)
            .col(date_time(Permission::CreatedAt).default(Expr::current_timestamp()))
            .col(date_time(Permission::UpdatedAt).default(Expr::current_timestamp()))
            .col(pk_auto(Permission::Id))
            .col(string_uniq(Permission::Name))
            .col(string_null(Permission::Description))
            .col(string_null(Permission::Resource)) // 资源名称，如 "devices", "tasks", "users"
            .col(string_null(Permission::Action)) // 操作名称，如 "read", "write", "delete"
            .to_owned();
        manager.create_table(table).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Permission::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
pub enum Permission {
    Table,
    CreatedAt,
    UpdatedAt,
    Id,
    Name,
    Description,
    Resource,
    Action,
}
