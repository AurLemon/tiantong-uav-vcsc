use sea_orm::entity::prelude::*;
use sea_orm::Set;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "weather_condition")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::collection_data::Entity")]
    CollectionData,
}

impl Related<super::collection_data::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CollectionData.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            created_at: Set(
                chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap())
            ),
            updated_at: Set(
                chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap())
            ),
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
    #[sea_orm(entity = "super::collection_data::Entity")]
    CollectionData,
}
