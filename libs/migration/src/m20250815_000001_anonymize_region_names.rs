use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 更新 history 表中的 region 字段
        let update_history_queries = vec![
            "UPDATE history SET region = 'A县' WHERE region = '东山县'",
            "UPDATE history SET region = 'B县' WHERE region = '云霄县'",
            "UPDATE history SET region = 'C县' WHERE region = '华安县'",
            "UPDATE history SET region = 'D县' WHERE region = '南靖县'",
            "UPDATE history SET region = 'E县' WHERE region = '平和县'",
            "UPDATE history SET region = 'F县' WHERE region = '漳浦县'",
            "UPDATE history SET region = 'G区' WHERE region = '芗城区'",
            "UPDATE history SET region = 'H县' WHERE region = '诏安县'",
            "UPDATE history SET region = 'I县' WHERE region = '长泰县'",
            "UPDATE history SET region = 'J区' WHERE region = '龙文区'",
            "UPDATE history SET region = 'K市' WHERE region = '龙海市'",
            "UPDATE history SET region = '甲市' WHERE region = '漳州市'",
        ];

        for query in update_history_queries {
            manager.get_connection().execute_unprepared(query).await?;
        }

        // 更新 prediction 表中的 region 字段
        let update_prediction_queries = vec![
            "UPDATE prediction SET region = 'A县' WHERE region = '东山县'",
            "UPDATE prediction SET region = 'B县' WHERE region = '云霄县'",
            "UPDATE prediction SET region = 'C县' WHERE region = '华安县'",
            "UPDATE prediction SET region = 'D县' WHERE region = '南靖县'",
            "UPDATE prediction SET region = 'E县' WHERE region = '平和县'",
            "UPDATE prediction SET region = 'F县' WHERE region = '漳浦县'",
            "UPDATE prediction SET region = 'G区' WHERE region = '芗城区'",
            "UPDATE prediction SET region = 'H县' WHERE region = '诏安县'",
            "UPDATE prediction SET region = 'I县' WHERE region = '长泰县'",
            "UPDATE prediction SET region = 'J区' WHERE region = '龙文区'",
            "UPDATE prediction SET region = 'K市' WHERE region = '龙海市'",
            "UPDATE prediction SET region = '甲市' WHERE region = '漳州市'",
        ];

        for query in update_prediction_queries {
            manager.get_connection().execute_unprepared(query).await?;
        }

        // 更新 warn 表中的 JSON 内容
        // 由于 warn 表的 content 字段是 JSON 类型，需要使用 PostgreSQL 的 JSON 函数来更新
        let update_warn_queries = vec![
            // 替换 JSON 中的行政区名称
            "UPDATE warn SET content = replace(content::text, '东山县', 'A县')::json",
            "UPDATE warn SET content = replace(content::text, '云霄县', 'B县')::json",
            "UPDATE warn SET content = replace(content::text, '华安县', 'C县')::json",
            "UPDATE warn SET content = replace(content::text, '南靖县', 'D县')::json",
            "UPDATE warn SET content = replace(content::text, '平和县', 'E县')::json",
            "UPDATE warn SET content = replace(content::text, '漳浦县', 'F县')::json",
            "UPDATE warn SET content = replace(content::text, '芗城区', 'G区')::json",
            "UPDATE warn SET content = replace(content::text, '诏安县', 'H县')::json",
            "UPDATE warn SET content = replace(content::text, '长泰县', 'I县')::json",
            "UPDATE warn SET content = replace(content::text, '长泰区', 'I区')::json", // 处理可能的长泰区
            "UPDATE warn SET content = replace(content::text, '龙文区', 'J区')::json",
            "UPDATE warn SET content = replace(content::text, '龙海市', 'K市')::json",
            "UPDATE warn SET content = replace(content::text, '龙海区', 'K区')::json", // 处理可能的龙海区
            "UPDATE warn SET content = replace(content::text, '漳州市', '甲市')::json",
        ];

        for query in update_warn_queries {
            manager.get_connection().execute_unprepared(query).await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 回滚操作：将字母编码改回真实行政区名称

        // 回滚 history 表
        let rollback_history_queries = vec![
            "UPDATE history SET region = '东山县' WHERE region = 'A县'",
            "UPDATE history SET region = '云霄县' WHERE region = 'B县'",
            "UPDATE history SET region = '华安县' WHERE region = 'C县'",
            "UPDATE history SET region = '南靖县' WHERE region = 'D县'",
            "UPDATE history SET region = '平和县' WHERE region = 'E县'",
            "UPDATE history SET region = '漳浦县' WHERE region = 'F县'",
            "UPDATE history SET region = '芗城区' WHERE region = 'G区'",
            "UPDATE history SET region = '诏安县' WHERE region = 'H县'",
            "UPDATE history SET region = '长泰县' WHERE region = 'I县'",
            "UPDATE history SET region = '龙文区' WHERE region = 'J区'",
            "UPDATE history SET region = '龙海市' WHERE region = 'K市'",
            "UPDATE history SET region = '漳州市' WHERE region = '甲市'",
        ];

        for query in rollback_history_queries {
            manager.get_connection().execute_unprepared(query).await?;
        }

        // 回滚 prediction 表
        let rollback_prediction_queries = vec![
            "UPDATE prediction SET region = '东山县' WHERE region = 'A县'",
            "UPDATE prediction SET region = '云霄县' WHERE region = 'B县'",
            "UPDATE prediction SET region = '华安县' WHERE region = 'C县'",
            "UPDATE prediction SET region = '南靖县' WHERE region = 'D县'",
            "UPDATE prediction SET region = '平和县' WHERE region = 'E县'",
            "UPDATE prediction SET region = '漳浦县' WHERE region = 'F县'",
            "UPDATE prediction SET region = '芗城区' WHERE region = 'G区'",
            "UPDATE prediction SET region = '诏安县' WHERE region = 'H县'",
            "UPDATE prediction SET region = '长泰县' WHERE region = 'I县'",
            "UPDATE prediction SET region = '龙文区' WHERE region = 'J区'",
            "UPDATE prediction SET region = '龙海市' WHERE region = 'K市'",
            "UPDATE prediction SET region = '漳州市' WHERE region = '甲市'",
        ];

        for query in rollback_prediction_queries {
            manager.get_connection().execute_unprepared(query).await?;
        }

        // 回滚 warn 表
        let rollback_warn_queries = vec![
            "UPDATE warn SET content = replace(content::text, 'A县', '东山县')::json",
            "UPDATE warn SET content = replace(content::text, 'B县', '云霄县')::json",
            "UPDATE warn SET content = replace(content::text, 'C县', '华安县')::json",
            "UPDATE warn SET content = replace(content::text, 'D县', '南靖县')::json",
            "UPDATE warn SET content = replace(content::text, 'E县', '平和县')::json",
            "UPDATE warn SET content = replace(content::text, 'F县', '漳浦县')::json",
            "UPDATE warn SET content = replace(content::text, 'G区', '芗城区')::json",
            "UPDATE warn SET content = replace(content::text, 'H县', '诏安县')::json",
            "UPDATE warn SET content = replace(content::text, 'I县', '长泰县')::json",
            "UPDATE warn SET content = replace(content::text, 'I区', '长泰区')::json",
            "UPDATE warn SET content = replace(content::text, 'J区', '龙文区')::json",
            "UPDATE warn SET content = replace(content::text, 'K市', '龙海市')::json",
            "UPDATE warn SET content = replace(content::text, 'K区', '龙海区')::json",
            "UPDATE warn SET content = replace(content::text, '甲市', '漳州市')::json",
        ];

        for query in rollback_warn_queries {
            manager.get_connection().execute_unprepared(query).await?;
        }

        Ok(())
    }
}
