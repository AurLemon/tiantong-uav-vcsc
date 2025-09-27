use crate::models::{role, user, user_role};
use loco_rs::{auth::jwt, hash, prelude::*};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
pub struct PasswordLoginParams {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RegisterParams {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub pid: String,
    pub name: String,
    pub is_verified: bool,
}

impl LoginResponse {
    pub fn new(user: &user::Model, token: &String) -> Self {
        Self {
            token: token.to_string(),
            pid: user.pid.to_string(),
            name: user.name.clone(),
            is_verified: true,
        }
    }
}

async fn login(
    State(ctx): State<AppContext>,
    Json(params): Json<PasswordLoginParams>,
) -> Result<Response> {
    // Find user by email
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(&params.email))
        .one(&ctx.db)
        .await?;
    let Some(user) = user else {
        return unauthorized("unauthorized!");
    };

    // Verify password
    if !hash::verify_password(&params.password, &user.password) {
        return unauthorized("unauthorized!");
    }

    // Generate the JWT
    let jwt_secret = ctx.config.get_jwt_config()?;
    let token = jwt::JWT::new(&jwt_secret.secret)
        .generate_token(&jwt_secret.expiration, params.email.to_string(), None)
        .unwrap();

    // Login success
    format::json(LoginResponse::new(&user, &token))
}

async fn register(
    State(ctx): State<AppContext>,
    Json(params): Json<RegisterParams>,
) -> Result<Response> {
    // 检查邮箱是否已存在
    let existing_user = user::Entity::find()
        .filter(user::Column::Email.eq(&params.email))
        .one(&ctx.db)
        .await?;

    if existing_user.is_some() {
        return bad_request("邮箱已被注册");
    }

    // 加密密码
    let password_hash = hash::hash_password(&params.password)?;

    // 创建用户
    let new_user = user::ActiveModel {
        pid: Set(Uuid::new_v4()),
        email: Set(params.email.clone()),
        password: Set(password_hash),
        api_key: Set(format!("ak-{}", Uuid::new_v4())),
        name: Set(params.name),
        ..Default::default()
    };

    let user_result = user::Entity::insert(new_user).exec(&ctx.db).await?;

    // 为新用户分配默认的user角色
    let user_role_entity = role::Entity::find()
        .filter(role::Column::Name.eq("user"))
        .one(&ctx.db)
        .await?;

    if let Some(user_role) = user_role_entity {
        let new_user_role = user_role::ActiveModel {
            user_id: Set(user_result.last_insert_id),
            role_id: Set(user_role.id),
            ..Default::default()
        };

        user_role::Entity::insert(new_user_role)
            .exec(&ctx.db)
            .await?;
    }

    // 获取创建的用户信息
    let created_user = user::Entity::find_by_id(user_result.last_insert_id)
        .one(&ctx.db)
        .await?
        .ok_or_else(|| Error::string("用户创建失败"))?;

    // 生成JWT token
    let jwt_secret = ctx.config.get_jwt_config()?;
    let token = jwt::JWT::new(&jwt_secret.secret)
        .generate_token(&jwt_secret.expiration, params.email, None)
        .unwrap();

    format::json(LoginResponse::new(&created_user, &token))
}

pub fn routes() -> Routes {
    Routes::new()
        // Authentication route prefix
        .prefix("auth")
        // Handling login with password
        .add("/login", post(login))
        // Handling user registration
        .add("/register", post(register))
}
