use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 添加 drone_model 字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .add_column(string_null(Device::DroneModel))
                    .to_owned(),
            )
            .await?;

        // 添加 drone_brand 字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .add_column(string_null(Device::DroneBrand))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 删除 drone_brand 字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .drop_column(Device::DroneBrand)
                    .to_owned(),
            )
            .await?;

        // 删除 drone_model 字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .drop_column(Device::DroneModel)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(Iden)]
pub enum Device {
    Table,
    DroneModel,
    DroneBrand,
}
