use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 重命名 rtmp_url 字段为 easynvr_url
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .rename_column(Device::RtmpUrl, Device::EasynvrUrl)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 回滚：重命名 easynvr_url 字段为 rtmp_url
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .rename_column(Device::EasynvrUrl, Device::RtmpUrl)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Device {
    Table,
    RtmpUrl,
    EasynvrUrl,
}
