#![allow(
    elided_lifetimes_in_paths,
    clippy::wildcard_imports,
    clippy::enum_variant_names
)]
pub use sea_orm_migration::prelude::*;

mod m20250101_000001_user;
mod m20250101_000002_seed_user;
mod m20250101_000003_device;
mod m20250806_102144_create_task_table;
mod m20250806_110600_fix_task_timestamp_types;
mod m20250807_000001_create_roles_table;
mod m20250807_000002_create_permissions_table;
mod m20250807_000003_create_user_roles_table;
mod m20250807_000004_create_role_permissions_table;
mod m20250807_000005_seed_rbac_data;
mod m20250808_000001_create_data_management_tables;
mod m20250808_000002_create_collection_data_tables;
mod m20250810_000001_add_device_rtmp_fields;
mod m20250814_000001_add_device_drone_fields;
mod m20250815_000001_anonymize_region_names;
mod m20250821_000001_add_device_connection_status;
mod m20250821_000001_add_device_mqtt_and_realtime_data;
mod m20250821_000001_update_device_mqtt_fields;
mod m20250827_000001_change_websocket_url_to_port;
mod m20250901_000001_rename_rtmp_to_easynvr;
pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20250101_000001_user::Migration),
            Box::new(m20250101_000002_seed_user::Migration),
            Box::new(m20250101_000003_device::Migration),
            Box::new(m20250806_102144_create_task_table::Migration),
            Box::new(m20250806_110600_fix_task_timestamp_types::Migration),
            Box::new(m20250807_000001_create_roles_table::Migration),
            Box::new(m20250807_000002_create_permissions_table::Migration),
            Box::new(m20250807_000003_create_user_roles_table::Migration),
            Box::new(m20250807_000004_create_role_permissions_table::Migration),
            Box::new(m20250807_000005_seed_rbac_data::Migration),
            Box::new(m20250808_000001_create_data_management_tables::Migration),
            Box::new(m20250808_000002_create_collection_data_tables::Migration),
            Box::new(m20250810_000001_add_device_rtmp_fields::Migration),
            Box::new(m20250814_000001_add_device_drone_fields::Migration),
            Box::new(m20250815_000001_anonymize_region_names::Migration),
            Box::new(m20250821_000001_add_device_connection_status::Migration),
            Box::new(m20250821_000001_add_device_mqtt_and_realtime_data::Migration),
            Box::new(m20250821_000001_update_device_mqtt_fields::Migration),
            Box::new(m20250827_000001_change_websocket_url_to_port::Migration),
            Box::new(m20250901_000001_rename_rtmp_to_easynvr::Migration),
        ]
    }
}
