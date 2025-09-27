use crate::{
    config::{CompositeTableCfg, JsonCfg, RawTableCfg},
    DashboardCfg,
};

pub struct ConfigParser {}

impl ConfigParser {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self {}
    }

    pub fn load_config<T: Into<String>>(self, root_folder: T) -> anyhow::Result<JsonCfg> {
        let root_folder = root_folder.into();
        // Load site config
        let content = std::fs::read_to_string(format!("{root_folder}/config.toml"))
            .unwrap_or(DEFAULT_SITE_CONFIG.into());
        let mut json_config: JsonCfg = toml::from_str(&content)?;

        // Load site config
        let content = std::fs::read_to_string(format!("{root_folder}/dashboard.toml"))
            .unwrap_or(DEFAULT_DASHBOARD_CONFIG.into());
        let dashboard_config: DashboardCfg = toml::from_str(&content)?;
        json_config.dashboard = dashboard_config;

        // Load raw table config
        let walkdir = walkdir::WalkDir::new(format!("{root_folder}/raw_tables"));
        for file in walkdir.into_iter().filter_map(|e| e.ok()).skip(1) {
            let file_name = file.file_name().to_str().unwrap();
            let (name, _ext) = file_name.split_once('.').unwrap();
            let content = std::fs::read_to_string(file.path())?;
            let raw_table: RawTableCfg = toml::from_str(&content)?;
            json_config.raw_tables.insert(name.into(), raw_table);
        }

        // Load composite table config
        let walkdir = walkdir::WalkDir::new(format!("{root_folder}/composite_tables"));
        for file in walkdir.into_iter().filter_map(|e| e.ok()).skip(1) {
            let file_name = file.file_name().to_str().unwrap();
            let (name, _ext) = file_name.split_once('.').unwrap();
            let content = std::fs::read_to_string(file.path())?;
            let composite_table: CompositeTableCfg = toml::from_str(&content)?;
            json_config
                .composite_tables
                .insert(name.into(), composite_table);
        }

        Ok(json_config)
    }
}

const DEFAULT_SITE_CONFIG: &str = r#"
[site.theme]
title = "SeaORM Pro"
logo = "https://www.sea-ql.org/favicon.ico"
login_banner = "https://www.sea-ql.org/img/SeaQL%20logo.png"
"#;

const DEFAULT_DASHBOARD_CONFIG: &str = r#"
title = "SeaORM Pro"
subtitle = "Build professional admin panels with SeaORM Pro."

[[info.card]]
title = "What is SeaORM Pro?"
description = "SeaORM Pro is an admin panel solution allowing you to quickly and easily launch an admin panel for your application."
link = "https://www.sea-ql.org/sea-orm-pro/docs/introduction/sea-orm-pro/"
"#;
