use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 添加 rtmp_url 字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .add_column(string_null(Device::RtmpUrl))
                    .to_owned(),
            )
            .await?;

        // 添加 http_api_url 字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .add_column(string_null(Device::HttpApiUrl))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 删除 http_api_url 字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .drop_column(Device::HttpApiUrl)
                    .to_owned(),
            )
            .await?;

        // 删除 rtmp_url 字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .drop_column(Device::RtmpUrl)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(Iden)]
pub enum Device {
    Table,
    RtmpUrl,
    HttpApiUrl,
}
