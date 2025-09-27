use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Task {
    Table,
    StartTime,
    EndTime,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 修改 start_time 字段类型为 TIMESTAMPTZ
        manager
            .alter_table(
                Table::alter()
                    .table(Task::Table)
                    .modify_column(timestamp_with_time_zone_null(Task::StartTime))
                    .to_owned(),
            )
            .await?;

        // 修改 end_time 字段类型为 TIMESTAMPTZ
        manager
            .alter_table(
                Table::alter()
                    .table(Task::Table)
                    .modify_column(timestamp_with_time_zone_null(Task::EndTime))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 回滚：将字段类型改回 TIMESTAMP
        manager
            .alter_table(
                Table::alter()
                    .table(Task::Table)
                    .modify_column(timestamp_null(Task::StartTime))
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Task::Table)
                    .modify_column(timestamp_null(Task::EndTime))
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}
