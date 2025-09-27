use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "history")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub rid: Option<i32>,
    pub region: Option<String>,
    pub tid: Option<i32>,
    pub v: Option<Decimal>,
    pub tm: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::region::Entity",
        from = "Column::Rid",
        to = "super::region::Column::Id"
    )]
    Region,
    #[sea_orm(
        belongs_to = "super::element_type::Entity",
        from = "Column::Tid",
        to = "super::element_type::Column::Id"
    )]
    ElementType,
}

impl Related<super::region::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Region.def()
    }
}

impl Related<super::element_type::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ElementType.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelatedEntity)]
pub enum RelatedEntity {
    #[sea_orm(entity = "super::region::Entity")]
    Region,
    #[sea_orm(entity = "super::element_type::Entity")]
    ElementType,
}
