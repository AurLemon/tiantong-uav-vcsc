use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 1. 为device表添加MQTT配置字段
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

        // 2. 创建设备实时数据表
        manager
            .create_table(
                Table::create()
                    .table(DeviceRealtimeData::Table)
                    .col(
                        big_integer(DeviceRealtimeData::Id)
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(integer(DeviceRealtimeData::DeviceId).not_null())
                    .col(string_len(DeviceRealtimeData::DataType, 50).not_null())
                    .col(json(DeviceRealtimeData::DataContent).not_null())
                    .col(timestamp_with_time_zone(DeviceRealtimeData::ReceivedAt).not_null())
                    .col(timestamp_with_time_zone(DeviceRealtimeData::CreatedAt).not_null())
                    .col(timestamp_with_time_zone(DeviceRealtimeData::UpdatedAt).not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_device_realtime_data_device_id")
                            .from(DeviceRealtimeData::Table, DeviceRealtimeData::DeviceId)
                            .to(Device::Table, Device::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // 3. 创建索引
        manager
            .create_index(
                Index::create()
                    .name("idx_device_realtime_data_device_id")
                    .table(DeviceRealtimeData::Table)
                    .col(DeviceRealtimeData::DeviceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_device_realtime_data_received_at")
                    .table(DeviceRealtimeData::Table)
                    .col(DeviceRealtimeData::ReceivedAt)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 删除索引
        manager
            .drop_index(
                Index::drop()
                    .name("idx_device_realtime_data_device_id")
                    .to_owned(),
            )
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("idx_device_realtime_data_received_at")
                    .to_owned(),
            )
            .await?;

        // 删除设备实时数据表
        manager
            .drop_table(Table::drop().table(DeviceRealtimeData::Table).to_owned())
            .await?;

        // 删除device表的MQTT字段
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

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Device {
    Table,
    Id,
    MqttBrokerUrl,
    MqttTopic,
    MqttClientId,
}

#[derive(DeriveIden)]
enum DeviceRealtimeData {
    Table,
    Id,
    DeviceId,
    DataType,
    DataContent,
    ReceivedAt,
    CreatedAt,
    UpdatedAt,
}
