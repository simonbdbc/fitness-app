use axum::{Json, Router, routing::get};

use crate::features::profiles::model::{Profile, demo_profile};
use crate::shared::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/demo", get(get_demo_profile))
}

async fn get_demo_profile() -> Json<Profile> {
    Json(demo_profile())
}
