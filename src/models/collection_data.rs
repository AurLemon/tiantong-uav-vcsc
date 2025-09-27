use sea_orm::entity::prelude::*;
use sea_orm::Set;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "collection_data")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub longitude: Decimal,
    pub latitude: Decimal,
    pub altitude: Option<Decimal>,
    pub temperature: Option<Decimal>,
    pub humidity: Option<Decimal>,
    pub device_id: Option<i32>,
    pub image_url: Option<String>,
    pub weather_condition_id: Option<i32>,
    pub collected_at: DateTimeWithTimeZone,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::device::Entity",
        from = "Column::DeviceId",
        to = "super::device::Column::Id"
    )]
    Device,
    #[sea_orm(
        belongs_to = "super::weather_condition::Entity",
        from = "Column::WeatherConditionId",
        to = "super::weather_condition::Column::Id"
    )]
    WeatherCondition,
}

impl Related<super::device::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Device.def()
    }
}

impl Related<super::weather_condition::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::WeatherCondition.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        let now =
            chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap());
        Self {
            collected_at: Set(now),
            created_at: Set(now),
            updated_at: Set(now),
            ..ActiveModelTrait::default()
        }
    }

    fn before_save<'life0, 'async_trait, C>(
        mut self,
        _db: &'life0 C,
        _insert: bool,
    ) -> core::pin::Pin<
        Box<
            dyn core::future::Future<Output = Result<Self, DbErr>>
                + core::marker::Send
                + 'async_trait,
        >,
    >
    where
        'life0: 'async_trait,
        C: 'async_trait + ConnectionTrait,
        Self: 'async_trait,
    {
        Box::pin(async move {
            self.updated_at =
                Set(chrono::Utc::now()
                    .with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap()));
            Ok(self)
        })
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelatedEntity)]
pub enum RelatedEntity {
    #[sea_orm(entity = "super::device::Entity")]
    Device,
    #[sea_orm(entity = "super::weather_condition::Entity")]
    WeatherCondition,
}
