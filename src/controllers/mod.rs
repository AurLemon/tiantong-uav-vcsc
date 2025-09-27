pub mod admin;
pub mod auth;
pub mod collection_data;
pub mod common;
pub mod device;
pub mod element_type;
pub mod graphql;
pub mod prediction;
pub mod rbac;
pub mod realtime;
pub mod task;
pub mod upload;
pub mod user;
pub mod warn;
pub mod weather_condition;

// Response of web controller
#[derive(Debug, serde::Serialize)]
pub struct Res {
    success: bool,
    message: String,
}

impl Res {
    // Success
    pub fn success<T: ToString>(message: T) -> Self {
        Self {
            success: true,
            message: message.to_string(),
        }
    }

    // Failed
    pub fn fail<T: ToString>(message: T) -> Self {
        Self {
            success: false,
            message: message.to_string(),
        }
    }
}
