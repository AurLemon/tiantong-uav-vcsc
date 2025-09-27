use serde::{Deserialize, Deserializer, Serialize};
use std::fmt::Display;
use std::str::FromStr;

// Helper function to deserialize a value from a string, which is useful for query parameters.
fn from_str<'de, T, D>(deserializer: D) -> Result<T, D::Error>
where
    T: FromStr,
    T::Err: Display,
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    T::from_str(&s).map_err(serde::de::Error::custom)
}

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_page", deserialize_with = "from_str")]
    pub page: u64,
    #[serde(default = "default_page_size", deserialize_with = "from_str")]
    pub page_size: u64,
}

fn default_page() -> u64 {
    1
}

fn default_page_size() -> u64 {
    20
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub current_page: u64,
    pub page_size: u64,
    pub total_pages: u64,
    pub total_items: u64,
    pub has_next: bool,
    pub has_prev: bool,
}

impl PaginationParams {
    pub fn validate(&mut self) {
        if self.page == 0 {
            self.page = 1;
        }
        if self.page_size == 0 || self.page_size > 100 {
            self.page_size = 20;
        }
    }

    pub fn offset(&self) -> u64 {
        (self.page - 1) * self.page_size
    }
}

// 删除了不兼容的paginate函数，使用manual_paginate代替

// 手动分页实现（当需要自定义查询时使用）
pub fn manual_paginate<T>(
    total_count: u64,
    data: Vec<T>,
    params: &PaginationParams,
) -> PaginatedResponse<T> {
    let total_pages = (total_count + params.page_size - 1) / params.page_size;

    PaginatedResponse {
        data,
        pagination: PaginationInfo {
            current_page: params.page,
            page_size: params.page_size,
            total_pages,
            total_items: total_count,
            has_next: params.page < total_pages,
            has_prev: params.page > 1,
        },
    }
}
