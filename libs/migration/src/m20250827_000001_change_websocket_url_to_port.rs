use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 删除旧的websocket_url字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .drop_column(Device::WebsocketUrl)
                    .to_owned(),
            )
            .await?;

        // 添加新的websocket_port字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .add_column(integer_null(Device::WebsocketPort))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 删除websocket_port字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .drop_column(Device::WebsocketPort)
                    .to_owned(),
            )
            .await?;

        // 恢复websocket_url字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .add_column(string(Device::WebsocketUrl))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(Iden)]
pub enum Device {
    Table,
    WebsocketUrl,
    WebsocketPort,
}
