use sea_orm::entity::prelude::*;
use sea_orm::{QueryOrder, QuerySelect, Set};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// 清理JSON值中的控制字符
fn clean_json_value(value: JsonValue) -> JsonValue {
    match value {
        JsonValue::String(s) => {
            let cleaned = s
                .chars()
                .filter(|c| !c.is_control() || *c == '\n' || *c == '\r' || *c == '\t')
                .collect::<String>()
                .replace("\\u0000", "")
                .replace("\\u000e", "")
                .replace("\\u001f", "")
                .replace("\\u007f", "")
                .replace("\\u0001", "")
                .replace("\\u0002", "")
                .replace("\\u0003", "")
                .replace("\\u0004", "")
                .replace("\\u0005", "")
                .replace("\\u0006", "")
                .replace("\\u0007", "")
                .replace("\\u0008", "")
                .replace("\\u000b", "")
                .replace("\\u000c", "")
                .replace("\\u000f", "");
            JsonValue::String(cleaned)
        }
        JsonValue::Object(map) => {
            let cleaned_map: serde_json::Map<String, JsonValue> = map
                .into_iter()
                .map(|(k, v)| (k, clean_json_value(v)))
                .collect();
            JsonValue::Object(cleaned_map)
        }
        JsonValue::Array(arr) => {
            let cleaned_arr: Vec<JsonValue> = arr.into_iter().map(clean_json_value).collect();
            JsonValue::Array(cleaned_arr)
        }
        _ => value,
    }
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "device_realtime_data")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub device_id: i32,
    pub data_type: String, // "websocket" 或 "mqtt"
    pub data_content: JsonValue,
    pub received_at: DateTimeWithTimeZone,
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
}

impl Related<super::device::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Device.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRealtimeDataRequest {
    pub device_id: i32,
    pub data_type: String,
    pub data_content: JsonValue,
}

#[derive(Debug, Serialize)]
pub struct RealtimeDataResponse {
    pub id: i64,
    pub device_id: i32,
    pub data_type: String,
    pub data_content: JsonValue,
    pub received_at: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Model> for RealtimeDataResponse {
    fn from(data: Model) -> Self {
        Self {
            id: data.id,
            device_id: data.device_id,
            data_type: data.data_type,
            data_content: data.data_content,
            received_at: data.received_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            created_at: data.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: data.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        }
    }
}

impl Model {
    /// 创建新的实时数据记录
    pub async fn create_realtime_data(
        db: &DatabaseConnection,
        device_id: i32,
        data_type: &str,
        data_content: JsonValue,
    ) -> Result<Model, DbErr> {
        let now =
            chrono::Utc::now().with_timezone(&chrono::FixedOffset::east_opt(8 * 3600).unwrap());

        // 清理JSON中的控制字符
        let cleaned_content = clean_json_value(data_content);

        let new_data = ActiveModel {
            device_id: Set(device_id),
            data_type: Set(data_type.to_string()),
            data_content: Set(cleaned_content),
            received_at: Set(now),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };

        new_data.insert(db).await
    }

    /// 获取设备的最新实时数据
    pub async fn get_latest_by_device(
        db: &DatabaseConnection,
        device_id: i32,
        limit: u64,
    ) -> Result<Vec<Model>, DbErr> {
        Entity::find()
            .filter(Column::DeviceId.eq(device_id))
            .order_by_desc(Column::ReceivedAt)
            .limit(limit)
            .all(db)
            .await
    }

    /// 获取设备指定类型的最新数据
    pub async fn get_latest_by_device_and_type(
        db: &DatabaseConnection,
        device_id: i32,
        data_type: &str,
        limit: u64,
    ) -> Result<Vec<Model>, DbErr> {
        Entity::find()
            .filter(Column::DeviceId.eq(device_id))
            .filter(Column::DataType.eq(data_type))
            .order_by_desc(Column::ReceivedAt)
            .limit(limit)
            .all(db)
            .await
    }
}
