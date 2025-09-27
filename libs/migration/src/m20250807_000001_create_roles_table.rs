use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let table = Table::create()
            .table(Role::Table)
            .col(date_time(Role::CreatedAt).default(Expr::current_timestamp()))
            .col(date_time(Role::UpdatedAt).default(Expr::current_timestamp()))
            .col(pk_auto(Role::Id))
            .col(string_uniq(Role::Name))
            .col(string_null(Role::Description))
            .col(boolean(Role::IsActive).default(true))
            .to_owned();
        manager.create_table(table).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Role::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
pub enum Role {
    Table,
    CreatedAt,
    UpdatedAt,
    Id,
    Name,
    Description,
    IsActive,
}
