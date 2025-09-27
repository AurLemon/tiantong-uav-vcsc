use axum::{
    extract::{Multipart, State},
    Json,
};
use loco_rs::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub filename: String,
    pub size: u64,
    pub content_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UploadConfig {
    pub max_file_size: u64,
    pub allowed_extensions: Vec<String>,
    pub upload_path: String,
    pub base_url: String,
}

impl Default for UploadConfig {
    fn default() -> Self {
        Self {
            max_file_size: 10 * 1024 * 1024, // 10MB
            allowed_extensions: vec![
                "jpg".to_string(),
                "jpeg".to_string(),
                "png".to_string(),
                "gif".to_string(),
                "webp".to_string(),
            ],
            upload_path: "uploads".to_string(),
            base_url: "/uploads".to_string(),
        }
    }
}

/// 上传图片文件
pub async fn upload_image(
    State(_ctx): State<AppContext>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>> {
    let config = UploadConfig::default();

    // 确保上传目录存在
    let upload_dir = PathBuf::from(&config.upload_path);
    if !upload_dir.exists() {
        fs::create_dir_all(&upload_dir)
            .await
            .map_err(|e| Error::string(&format!("Failed to create upload directory: {}", e)))?;
    }

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::string(&format!("Failed to read multipart field: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name != "file" {
            continue;
        }

        let filename = field
            .file_name()
            .ok_or_else(|| Error::string("No filename provided"))?
            .to_string();

        let content_type = field.content_type().map(|ct| ct.to_string());

        // 验证文件扩展名
        let extension = PathBuf::from(&filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_lowercase())
            .ok_or_else(|| Error::string("Invalid file extension"))?;

        if !config.allowed_extensions.contains(&extension) {
            return Err(Error::string(&format!(
                "File extension '{}' not allowed. Allowed extensions: {}",
                extension,
                config.allowed_extensions.join(", ")
            )));
        }

        // 读取文件数据
        let data = field
            .bytes()
            .await
            .map_err(|e| Error::string(&format!("Failed to read file data: {}", e)))?;

        // 验证文件大小
        if data.len() as u64 > config.max_file_size {
            return Err(Error::string(&format!(
                "File size {} bytes exceeds maximum allowed size {} bytes",
                data.len(),
                config.max_file_size
            )));
        }

        // 生成唯一文件名
        let unique_filename = format!(
            "{}_{}.{}",
            chrono::Utc::now().format("%Y%m%d_%H%M%S"),
            Uuid::new_v4().to_string()[..8].to_string(),
            extension
        );

        let file_path = upload_dir.join(&unique_filename);

        // 保存文件
        fs::write(&file_path, &data)
            .await
            .map_err(|e| Error::string(&format!("Failed to save file: {}", e)))?;

        let url = format!("{}/{}", config.base_url, unique_filename);

        return Ok(Json(UploadResponse {
            url,
            filename: unique_filename,
            size: data.len() as u64,
            content_type,
        }));
    }

    Err(Error::string("No file field found"))
}

/// 删除上传的文件
pub async fn delete_file(
    State(_ctx): State<AppContext>,
    Json(req): Json<DeleteFileRequest>,
) -> Result<Json<serde_json::Value>> {
    let config = UploadConfig::default();

    // 从URL中提取文件名
    let filename = req
        .url
        .strip_prefix(&format!("{}/", config.base_url))
        .ok_or_else(|| Error::string("Invalid file URL"))?;

    let file_path = PathBuf::from(&config.upload_path).join(filename);

    // 检查文件是否存在
    if !file_path.exists() {
        return Err(Error::NotFound);
    }

    // 删除文件
    fs::remove_file(&file_path)
        .await
        .map_err(|e| Error::string(&format!("Failed to delete file: {}", e)))?;

    Ok(Json(serde_json::json!({
        "message": "File deleted successfully",
        "url": req.url
    })))
}

#[derive(Debug, Deserialize)]
pub struct DeleteFileRequest {
    pub url: String,
}

// 预留腾讯云COS接口结构
#[derive(Debug, Clone)]
pub struct CosConfig {
    pub secret_id: String,
    pub secret_key: String,
    pub region: String,
    pub bucket: String,
    pub domain: String,
}

// 腾讯云COS上传接口（预留）
#[allow(dead_code)]
pub async fn upload_to_cos(
    _config: &CosConfig,
    _filename: &str,
    _data: &[u8],
    _content_type: Option<&str>,
) -> Result<String> {
    // TODO: 实现腾讯云COS上传逻辑
    // 1. 使用腾讯云SDK或HTTP API
    // 2. 上传文件到COS
    // 3. 返回文件的公网访问URL

    // 示例返回值
    Err(Error::string("COS upload not implemented yet"))
}

// 腾讯云COS删除接口（预留）
#[allow(dead_code)]
pub async fn delete_from_cos(_config: &CosConfig, _filename: &str) -> Result<()> {
    // TODO: 实现腾讯云COS删除逻辑

    Err(Error::string("COS delete not implemented yet"))
}

pub fn routes() -> Routes {
    Routes::new()
        .prefix("upload")
        .add("/image", post(upload_image))
        .add("/delete", post(delete_file))
}
