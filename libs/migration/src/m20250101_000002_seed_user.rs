use super::m20250101_000001_user::User;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use sea_orm_migration::prelude::*;
use uuid::Uuid;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // 生成 "tiantong" 的密码哈希
        let password = "tiantong";
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| DbErr::Custom(format!("Failed to hash password: {}", e)))?
            .to_string();

        let insert = Query::insert()
            .into_table(User::Table)
            .columns([
                User::Pid,
                User::Email,
                User::Password,
                User::ApiKey,
                User::Name,
            ])
            .values_panic([
                Uuid::new_v4().into(),
                "tiantong".into(),
                password_hash.into(),
                format!("tt-{}", Uuid::new_v4()).into(),
                "Tiantong User".into(),
            ])
            .to_owned();
        manager.exec_stmt(insert).await?;

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
