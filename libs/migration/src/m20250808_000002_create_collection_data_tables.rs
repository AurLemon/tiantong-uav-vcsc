use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 创建 weather_condition 表 (天气情况表)
        let weather_condition_table = Table::create()
            .table(WeatherCondition::Table)
            .col(integer(WeatherCondition::Id).auto_increment().primary_key())
            .col(string(WeatherCondition::Name).not_null())
            .col(string_null(WeatherCondition::Description))
            .col(
                timestamp_with_time_zone(WeatherCondition::CreatedAt)
                    .default(Expr::current_timestamp()),
            )
            .col(
                timestamp_with_time_zone(WeatherCondition::UpdatedAt)
                    .default(Expr::current_timestamp()),
            )
            .to_owned();
        manager.create_table(weather_condition_table).await?;

        // 创建 collection_data 表 (采集数据表)
        let collection_data_table = Table::create()
            .table(CollectionData::Table)
            .col(
                big_integer(CollectionData::Id)
                    .auto_increment()
                    .primary_key(),
            )
            .col(decimal_len(CollectionData::Longitude, 10, 7).not_null()) // 经度
            .col(decimal_len(CollectionData::Latitude, 10, 7).not_null()) // 纬度
            .col(decimal_len_null(CollectionData::Altitude, 10, 2)) // 高度
            .col(decimal_len_null(CollectionData::Temperature, 5, 2)) // 温度
            .col(decimal_len_null(CollectionData::Humidity, 5, 2)) // 湿度
            .col(integer_null(CollectionData::DeviceId)) // 无人机ID
            .col(string_null(CollectionData::ImageUrl)) // 图片链接
            .col(integer_null(CollectionData::WeatherConditionId)) // 天气情况ID
            .col(
                timestamp_with_time_zone(CollectionData::CollectedAt)
                    .default(Expr::current_timestamp()),
            ) // 采集时间
            .col(
                timestamp_with_time_zone(CollectionData::CreatedAt)
                    .default(Expr::current_timestamp()),
            )
            .col(
                timestamp_with_time_zone(CollectionData::UpdatedAt)
                    .default(Expr::current_timestamp()),
            )
            .foreign_key(
                ForeignKey::create()
                    .name("fk_collection_data_device_id")
                    .from(CollectionData::Table, CollectionData::DeviceId)
                    .to(Device::Table, Device::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .foreign_key(
                ForeignKey::create()
                    .name("fk_collection_data_weather_condition_id")
                    .from(CollectionData::Table, CollectionData::WeatherConditionId)
                    .to(WeatherCondition::Table, WeatherCondition::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .to_owned();
        manager.create_table(collection_data_table).await?;

        // 创建索引
        let collection_data_device_index = Index::create()
            .name("idx_collection_data_device_id")
            .table(CollectionData::Table)
            .col(CollectionData::DeviceId)
            .to_owned();
        manager.create_index(collection_data_device_index).await?;

        let collection_data_collected_at_index = Index::create()
            .name("idx_collection_data_collected_at")
            .table(CollectionData::Table)
            .col(CollectionData::CollectedAt)
            .to_owned();
        manager
            .create_index(collection_data_collected_at_index)
            .await?;

        let collection_data_weather_index = Index::create()
            .name("idx_collection_data_weather_condition_id")
            .table(CollectionData::Table)
            .col(CollectionData::WeatherConditionId)
            .to_owned();
        manager.create_index(collection_data_weather_index).await?;

        // 插入默认天气情况数据
        let weather_conditions = vec![
            ("晴朗", "天空晴朗，无云或少云"),
            ("多云", "天空有较多云层"),
            ("阴天", "天空被云层完全覆盖"),
            ("小雨", "降雨量较小"),
            ("中雨", "降雨量中等"),
            ("大雨", "降雨量较大"),
            ("雷阵雨", "伴有雷电的阵雨"),
            ("雾", "能见度较低的雾天"),
            ("霾", "空气中有霾"),
            ("雪", "降雪天气"),
        ];

        for (name, description) in weather_conditions {
            let insert_stmt = Query::insert()
                .into_table(WeatherCondition::Table)
                .columns([WeatherCondition::Name, WeatherCondition::Description])
                .values_panic([name.into(), description.into()])
                .to_owned();
            manager.exec_stmt(insert_stmt).await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(CollectionData::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(WeatherCondition::Table).to_owned())
            .await?;
        Ok(())
    }
}

// 表名枚举定义
#[derive(Iden)]
pub enum WeatherCondition {
    Table,
    Id,
    Name,
    Description,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
pub enum CollectionData {
    Table,
    Id,
    Longitude,
    Latitude,
    Altitude,
    Temperature,
    Humidity,
    DeviceId,
    ImageUrl,
    WeatherConditionId,
    CollectedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
pub enum Device {
    Table,
    Id,
}
