use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let table = Table::create()
            .table(Device::Table)
            .col(date_time(Device::CreatedAt).default(Expr::current_timestamp()))
            .col(date_time(Device::UpdatedAt).default(Expr::current_timestamp()))
            .col(pk_auto(Device::Id))
            .col(uuid(Device::Uuid).unique_key())
            .col(string(Device::Name))
            .col(string(Device::WebsocketUrl))
            .col(string_null(Device::Description))
            .col(boolean(Device::IsDefault).default(false))
            .col(boolean(Device::IsActive).default(true))
            .col(integer(Device::UserId))
            .foreign_key(
                ForeignKey::create()
                    .name("fk_device_user_id")
                    .from(Device::Table, Device::UserId)
                    .to(User::Table, User::Id)
                    .on_delete(ForeignKeyAction::Cascade)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .to_owned();
        manager.create_table(table).await?;

        // 创建索引
        let index = Index::create()
            .name("idx_device_user_id")
            .table(Device::Table)
            .col(Device::UserId)
            .to_owned();
        manager.create_index(index).await?;

        // 创建唯一索引确保每个用户只能有一个默认设备
        let unique_default_index = Index::create()
            .name("idx_device_user_default_unique")
            .table(Device::Table)
            .col(Device::UserId)
            .col(Device::IsDefault)
            .unique()
            .to_owned();
        manager.create_index(unique_default_index).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Device::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
pub enum Device {
    Table,
    CreatedAt,
    UpdatedAt,
    Id,
    Uuid,
    Name,
    WebsocketUrl,
    Description,
    IsDefault,
    IsActive,
    UserId,
}

#[derive(Iden)]
pub enum User {
    Table,
    Id,
}
