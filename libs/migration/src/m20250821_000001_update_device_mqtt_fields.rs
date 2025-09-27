use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 删除不需要的MQTT字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .drop_column(Device::MqttBrokerUrl)
                    .drop_column(Device::MqttTopic)
                    .drop_column(Device::MqttClientId)
                    .to_owned(),
            )
            .await?;

        // 添加新的MQTT字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .add_column(
                        ColumnDef::new(Device::MqttPort)
                            .integer()
                            .null()
                            .comment("MQTT broker port for this device"),
                    )
                    .add_column(
                        ColumnDef::new(Device::MqttEnabled)
                            .boolean()
                            .default(false)
                            .not_null()
                            .comment("Whether MQTT is enabled for this device"),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 回退：删除新字段，恢复旧字段
        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .drop_column(Device::MqttPort)
                    .drop_column(Device::MqttEnabled)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Device::Table)
                    .add_column(ColumnDef::new(Device::MqttBrokerUrl).string().null())
                    .add_column(ColumnDef::new(Device::MqttTopic).string().null())
                    .add_column(ColumnDef::new(Device::MqttClientId).string().null())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Device {
    Table,
    MqttBrokerUrl,
    MqttTopic,
    MqttClientId,
    MqttPort,
    MqttEnabled,
}
