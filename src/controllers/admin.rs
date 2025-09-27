use crate::models::{collection_data, device, prediction, task, user};
use chrono::{DateTime, Duration, Utc};
use loco_rs::controller::middleware::auth::JWT;
use loco_rs::prelude::*;
use sea_orm::{ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, QuerySelect};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_devices: i64,
    pub active_devices: i64,
    pub connected_devices: i64,
    pub total_tasks: i64,
    pub running_tasks: i64,
    pub completed_tasks: i64,
    pub failed_tasks: i64,
    pub recent_tasks: Vec<RecentTask>,
    pub device_status_chart: Vec<DeviceStatusItem>,
    pub task_trend_chart: Vec<TaskTrendItem>,
    pub collection_data_count: i64,
    pub prediction_data_count: i64,
    pub collection_trend: Vec<DataTrendItem>,
    pub prediction_trend: Vec<DataTrendItem>,
}

#[derive(Debug, Serialize)]
pub struct RecentTask {
    pub id: i32,
    pub uuid: String,
    pub name: String,
    pub status: String,
    pub device_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct DeviceStatusItem {
    pub name: String,
    pub value: i64,
}

#[derive(Debug, Serialize)]
pub struct TaskTrendItem {
    pub date: String,
    pub completed: i64,
    pub failed: i64,
}

#[derive(Debug, Serialize)]
pub struct DataTrendItem {
    pub date: String,
    pub value: i64,
}

/// 获取仪表盘统计数据
pub async fn get_dashboard_stats(auth: JWT, State(ctx): State<AppContext>) -> Result<Response> {
    // 根据JWT获取用户ID
    let user_entity = user::Entity::find()
        .filter(user::Column::Email.eq(&auth.claims.pid))
        .one(&ctx.db)
        .await?;

    let Some(user_model) = user_entity else {
        return unauthorized("用户未找到，请重新登录");
    };

    // 使用并发查询优化性能
    let db = &ctx.db;

    // 并发执行设备统计查询
    let device_stats_future = async {
        let devices = device::Entity::find()
            .filter(device::Column::UserId.eq(user_model.id))
            .all(db)
            .await?;

        let total_devices = devices.len() as i64;
        let active_devices = devices.iter().filter(|d| d.is_active).count() as i64;

        Ok::<(i64, i64), sea_orm::DbErr>((total_devices, active_devices))
    };

    // 并发执行任务统计查询 - 使用单个查询获取所有状态统计
    let task_stats_future = async {
        use sea_orm::QuerySelect;

        let task_counts = task::Entity::find()
            .filter(task::Column::UserId.eq(user_model.id))
            .select_only()
            .column_as(task::Column::Status, "status")
            .column_as(task::Column::Id.count(), "count")
            .group_by(task::Column::Status)
            .into_tuple::<(String, i64)>()
            .all(db)
            .await?;

        let total_tasks = task::Entity::find()
            .filter(task::Column::UserId.eq(user_model.id))
            .count(db)
            .await?;

        let mut running_tasks = 0i64;
        let mut completed_tasks = 0i64;
        let mut failed_tasks = 0i64;

        for (status, count) in task_counts {
            match status.as_str() {
                "running" => running_tasks = count,
                "completed" => completed_tasks = count,
                "failed" => failed_tasks = count,
                _ => {}
            }
        }

        Ok::<(i64, i64, i64, i64), sea_orm::DbErr>((
            total_tasks as i64,
            running_tasks,
            completed_tasks,
            failed_tasks,
        ))
    };

    // 并发执行最近任务查询
    let recent_tasks_future = async {
        let recent_tasks_data = task::Entity::find()
            .filter(task::Column::UserId.eq(user_model.id))
            .find_also_related(device::Entity)
            .order_by_desc(task::Column::CreatedAt)
            .limit(5)
            .all(db)
            .await?;

        let recent_tasks: Vec<RecentTask> = recent_tasks_data
            .into_iter()
            .map(|(task, device)| RecentTask {
                id: task.id,
                uuid: task.uuid.to_string(),
                name: task.name,
                status: task.status,
                device_name: device
                    .map(|d| d.name)
                    .unwrap_or_else(|| "未知设备".to_string()),
                created_at: task.created_at.into(),
            })
            .collect();

        Ok::<Vec<RecentTask>, sea_orm::DbErr>(recent_tasks)
    };

    // 并发执行数据统计查询
    let data_counts_future = async {
        let collection_count_future = collection_data::Entity::find().count(db);
        let prediction_count_future = prediction::Entity::find().count(db);

        let (collection_data_count, prediction_data_count) =
            tokio::try_join!(collection_count_future, prediction_count_future)?;

        Ok::<(u64, u64), sea_orm::DbErr>((collection_data_count, prediction_data_count))
    };

    // 并发执行趋势数据查询（最近7天）- 使用简化的查询方式
    let trend_data_future = async {
        let now = Utc::now();
        let seven_days_ago = now - Duration::days(6);
        let start_date = seven_days_ago
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();
        let end_date = now.date_naive().and_hms_opt(23, 59, 59).unwrap().and_utc();

        // 获取最近7天的任务数据
        let task_trend_future = async {
            let tasks = task::Entity::find()
                .filter(task::Column::UserId.eq(user_model.id))
                .filter(task::Column::CreatedAt.between(start_date, end_date))
                .all(db)
                .await?;

            Ok::<Vec<task::Model>, sea_orm::DbErr>(tasks)
        };

        // 获取最近7天的采集数据
        let collection_trend_future = async {
            let collections = collection_data::Entity::find()
                .filter(collection_data::Column::CollectedAt.between(start_date, end_date))
                .all(db)
                .await?;

            Ok::<Vec<collection_data::Model>, sea_orm::DbErr>(collections)
        };

        // 获取最近7天的预报数据
        let prediction_trend_future = async {
            let predictions = prediction::Entity::find()
                .filter(prediction::Column::Tm.is_not_null())
                .filter(prediction::Column::Tm.between(start_date, end_date))
                .all(db)
                .await?;

            Ok::<Vec<prediction::Model>, sea_orm::DbErr>(predictions)
        };

        let (tasks, collections, predictions) = tokio::try_join!(
            task_trend_future,
            collection_trend_future,
            prediction_trend_future
        )?;

        Ok::<
            (
                Vec<task::Model>,
                Vec<collection_data::Model>,
                Vec<prediction::Model>,
            ),
            sea_orm::DbErr,
        >((tasks, collections, predictions))
    };

    // 并发执行所有查询
    let (
        (total_devices, active_devices),
        (total_tasks, running_tasks, completed_tasks, failed_tasks),
        recent_tasks,
        (collection_data_count, prediction_data_count),
        (tasks, collections, predictions),
    ) = tokio::try_join!(
        device_stats_future,
        task_stats_future,
        recent_tasks_future,
        data_counts_future,
        trend_data_future
    )?;

    // 连接设备数量（这里暂时使用活跃设备数，实际应该从WebSocket连接状态获取）
    let connected_devices = active_devices;

    // 设备状态图表数据
    let device_status_chart = vec![
        DeviceStatusItem {
            name: "活跃设备".to_string(),
            value: active_devices,
        },
        DeviceStatusItem {
            name: "非活跃设备".to_string(),
            value: total_devices - active_devices,
        },
    ];

    // 处理趋势数据，构建图表数据
    let now = Utc::now();
    let mut task_trend_chart = Vec::new();
    let mut collection_trend = Vec::new();
    let mut prediction_trend = Vec::new();

    // 为最近7天生成完整的日期范围
    for i in 0..7 {
        let date = now - Duration::days(6 - i);
        let date_str = date.format("%m-%d").to_string();
        let naive_date = date.date_naive();

        // 统计该日期的任务数据
        let mut completed_count = 0i64;
        let mut failed_count = 0i64;

        for task in &tasks {
            let task_date = task.created_at.date_naive();
            if task_date == naive_date {
                match task.status.as_str() {
                    "completed" => completed_count += 1,
                    "failed" => failed_count += 1,
                    _ => {}
                }
            }
        }

        task_trend_chart.push(TaskTrendItem {
            date: date_str.clone(),
            completed: completed_count,
            failed: failed_count,
        });

        // 统计该日期的采集数据
        let collection_count = collections
            .iter()
            .filter(|c| c.collected_at.date_naive() == naive_date)
            .count() as i64;

        collection_trend.push(DataTrendItem {
            date: date_str.clone(),
            value: collection_count,
        });

        // 统计该日期的预报数据
        let prediction_count = predictions
            .iter()
            .filter(|p| p.tm.as_ref().map(|t| t.date_naive()) == Some(naive_date))
            .count() as i64;

        prediction_trend.push(DataTrendItem {
            date: date_str,
            value: prediction_count,
        });
    }

    let stats = DashboardStats {
        total_devices,
        active_devices,
        connected_devices,
        total_tasks,
        running_tasks,
        completed_tasks,
        failed_tasks,
        recent_tasks,
        device_status_chart,
        task_trend_chart,
        collection_data_count: collection_data_count as i64,
        prediction_data_count: prediction_data_count as i64,
        collection_trend,
        prediction_trend,
    };

    format::json(stats)
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("admin")
        .add("/dashboard/stats", get(get_dashboard_stats))
}
