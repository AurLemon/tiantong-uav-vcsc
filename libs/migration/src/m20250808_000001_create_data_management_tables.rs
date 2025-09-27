use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 创建 region 表 (区县表)
        let region_table = Table::create()
            .table(Region::Table)
            .col(integer(Region::Id).primary_key())
            .col(string(Region::Name))
            .to_owned();
        manager.create_table(region_table).await?;

        // 创建 type 表 (元素类型表)
        let type_table = Table::create()
            .table(Type::Table)
            .col(integer(Type::Id).primary_key())
            .col(string(Type::Name))
            .to_owned();
        manager.create_table(type_table).await?;

        // 创建 history 表 (历史记录表)
        let history_table = Table::create()
            .table(History::Table)
            .col(big_integer(History::Id).auto_increment().primary_key())
            .col(integer_null(History::Rid))
            .col(string_null(History::Region))
            .col(integer_null(History::Tid))
            .col(decimal_len_null(History::V, 10, 2))
            .col(timestamp_with_time_zone_null(History::Tm))
            .foreign_key(
                ForeignKey::create()
                    .name("fk_history_region_id")
                    .from(History::Table, History::Rid)
                    .to(Region::Table, Region::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .foreign_key(
                ForeignKey::create()
                    .name("fk_history_type_id")
                    .from(History::Table, History::Tid)
                    .to(Type::Table, Type::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .to_owned();
        manager.create_table(history_table).await?;

        // 创建 prediction 表 (预报数据表)
        let prediction_table = Table::create()
            .table(Prediction::Table)
            .col(big_integer(Prediction::Id).auto_increment().primary_key())
            .col(string_null(Prediction::Region))
            .col(integer_null(Prediction::Tid))
            .col(decimal_len_null(Prediction::V, 10, 2))
            .col(timestamp_with_time_zone_null(Prediction::Tm))
            .foreign_key(
                ForeignKey::create()
                    .name("fk_prediction_type_id")
                    .from(Prediction::Table, Prediction::Tid)
                    .to(Type::Table, Type::Id)
                    .on_delete(ForeignKeyAction::SetNull)
                    .on_update(ForeignKeyAction::Cascade),
            )
            .to_owned();
        manager.create_table(prediction_table).await?;

        // 创建 info 表 (实时信息表)
        let info_table = Table::create()
            .table(Info::Table)
            .col(integer(Info::Id).auto_increment().primary_key())
            .col(string(Info::K))
            .col(decimal_len_null(Info::V, 10, 2))
            .col(integer(Info::Isnew).default(0))
            .to_owned();
        manager.create_table(info_table).await?;

        // 创建 info_area 表 (分区域实时数据表)
        let info_area_table = Table::create()
            .table(InfoArea::Table)
            .col(integer(InfoArea::Id).auto_increment().primary_key())
            .col(string(InfoArea::Region))
            .col(string(InfoArea::K))
            .col(decimal_len_null(InfoArea::V, 10, 2))
            .col(integer(InfoArea::Isnew).default(0))
            .to_owned();
        manager.create_table(info_area_table).await?;

        // 创建 warn 表 (风险个例库表)
        let warn_table = Table::create()
            .table(Warn::Table)
            .col(integer(Warn::Id).auto_increment().primary_key())
            .col(json_null(Warn::Content))
            .to_owned();
        manager.create_table(warn_table).await?;

        // 创建索引
        // history 表索引
        let history_region_index = Index::create()
            .name("idx_history_region")
            .table(History::Table)
            .col(History::Region)
            .to_owned();
        manager.create_index(history_region_index).await?;

        let history_tid_index = Index::create()
            .name("idx_history_tid")
            .table(History::Table)
            .col(History::Tid)
            .to_owned();
        manager.create_index(history_tid_index).await?;

        let history_tm_index = Index::create()
            .name("idx_history_tm")
            .table(History::Table)
            .col(History::Tm)
            .to_owned();
        manager.create_index(history_tm_index).await?;

        // prediction 表索引
        let prediction_region_index = Index::create()
            .name("idx_prediction_region")
            .table(Prediction::Table)
            .col(Prediction::Region)
            .to_owned();
        manager.create_index(prediction_region_index).await?;

        let prediction_tid_index = Index::create()
            .name("idx_prediction_tid")
            .table(Prediction::Table)
            .col(Prediction::Tid)
            .to_owned();
        manager.create_index(prediction_tid_index).await?;

        let prediction_tm_index = Index::create()
            .name("idx_prediction_tm")
            .table(Prediction::Table)
            .col(Prediction::Tm)
            .to_owned();
        manager.create_index(prediction_tm_index).await?;

        // info_area 表索引
        let info_area_region_index = Index::create()
            .name("idx_info_area_region")
            .table(InfoArea::Table)
            .col(InfoArea::Region)
            .to_owned();
        manager.create_index(info_area_region_index).await?;

        let info_area_k_index = Index::create()
            .name("idx_info_area_k")
            .table(InfoArea::Table)
            .col(InfoArea::K)
            .to_owned();
        manager.create_index(info_area_k_index).await?;

        // info 表索引
        let info_k_index = Index::create()
            .name("idx_info_k")
            .table(Info::Table)
            .col(Info::K)
            .to_owned();
        manager.create_index(info_k_index).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 按照依赖关系的逆序删除表
        manager
            .drop_table(Table::drop().table(Warn::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(InfoArea::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Info::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Prediction::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(History::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Type::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Region::Table).to_owned())
            .await?;
        Ok(())
    }
}

// 表名枚举定义
#[derive(Iden)]
pub enum Region {
    Table,
    Id,
    Name,
}

#[derive(Iden)]
pub enum Type {
    Table,
    Id,
    Name,
}

#[derive(Iden)]
pub enum History {
    Table,
    Id,
    Rid,
    Region,
    Tid,
    V,
    Tm,
}

#[derive(Iden)]
pub enum Prediction {
    Table,
    Id,
    Region,
    Tid,
    V,
    Tm,
}

#[derive(Iden)]
pub enum Info {
    Table,
    Id,
    K,
    V,
    Isnew,
}

#[derive(Iden)]
pub enum InfoArea {
    Table,
    Id,
    Region,
    K,
    V,
    Isnew,
}

#[derive(Iden)]
pub enum Warn {
    Table,
    Id,
    Content,
}
