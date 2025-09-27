//! This task implements data seeding functionality for initializing new
//! development/demo environments.
//!
//! # Example
//!
//! Run the task with the following command:
//! ```sh
//! cargo run task
//! ```
//!
//! To override existing data and reset the data structure, use the following
//! command with the `refresh:true` argument:
//! ```sh
//! cargo run task seed_data refresh:true
//! ```

use loco_rs::{db, prelude::*};
use migration::Migrator;

#[allow(clippy::module_name_repetitions)]
pub struct SeedData;
#[async_trait]
impl Task for SeedData {
    fn task(&self) -> TaskInfo {
        TaskInfo {
            name: "seed_data".to_string(),
            detail: "Task for seeding data".to_string(),
        }
    }

    async fn run(&self, app_context: &AppContext, vars: &task::Vars) -> Result<()> {
        let refresh = vars
            .cli_arg("refresh")
            .is_ok_and(|refresh| refresh == "true");
        let db = &app_context.db;

        // Run migration before seeding database
        if refresh {
            db::reset::<Migrator>(db).await?;
        } else {
            db::migrate::<Migrator>(db).await?;
        }

        // 已移除所有seed相关的宏和函数

        // 已移除所有seed数据，使用迁移中的默认用户数据
        println!("Seed task completed - using migration data!");

        Ok(())
    }
}

// 已移除seed_table函数
