use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Task {
    Table,
    Id,
    Uuid,
    Name,
    Description,
    TaskType,
    Status,
    DeviceId,
    UserId,
    Parameters,
    StartTime,
    EndTime,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Device {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Task::Table)
                    .if_not_exists()
                    .col(pk_auto(Task::Id))
                    .col(uuid(Task::Uuid).unique_key())
                    .col(string(Task::Name))
                    .col(string_null(Task::Description))
                    .col(string(Task::TaskType)) // 任务类型：manual, auto, scheduled
                    .col(string(Task::Status).default("pending")) // 状态：pending, running, completed, failed, cancelled
                    .col(integer(Task::DeviceId))
                    .col(integer(Task::UserId))
                    .col(json_null(Task::Parameters)) // 任务参数（JSON格式）
                    .col(timestamp_null(Task::StartTime))
                    .col(timestamp_null(Task::EndTime))
                    .col(
                        timestamp_with_time_zone(Task::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Task::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_device_id")
                            .from(Task::Table, Task::DeviceId)
                            .to(Device::Table, Device::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_task_user_id")
                            .from(Task::Table, Task::UserId)
                            .to(User::Table, User::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // 创建索引
        manager
            .create_index(
                Index::create()
                    .name("idx_task_device_id")
                    .table(Task::Table)
                    .col(Task::DeviceId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_task_user_id")
                    .table(Task::Table)
                    .col(Task::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_task_status")
                    .table(Task::Table)
                    .col(Task::Status)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Task::Table).to_owned())
            .await
    }
}
