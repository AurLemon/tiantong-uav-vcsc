use loco_rs::prelude::*;

async fn current(auth: auth::JWT, State(_ctx): State<AppContext>) -> Result<Response> {
    // Give the JWT is valid, return the user profile
    format::json(serde_json::json!({
        "pid": auth.claims.pid,
        "name": auth.claims.pid,
        "email": auth.claims.pid,
    }))
}

pub fn routes() -> Routes {
    Routes::new()
        // User route prefix
        .prefix("user")
        // Fetch user profile
        .add("/current", get(current))
}
