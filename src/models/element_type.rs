use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "type")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: i32,
    pub name: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::history::Entity")]
    Histories,
    #[sea_orm(has_many = "super::prediction::Entity")]
    Predictions,
}

impl Related<super::history::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Histories.def()
    }
}

impl Related<super::prediction::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Predictions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelatedEntity)]
pub enum RelatedEntity {
    #[sea_orm(entity = "super::history::Entity")]
    Histories,
    #[sea_orm(entity = "super::prediction::Entity")]
    Predictions,
}
