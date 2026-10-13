use axum::{Json, Router, routing::post};

use crate::features::level_tests::{model::ACREAEntryLevelTestInput, service};
use crate::shared::{error::AppError, state::AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/evaluate-acrea-entry", post(evaluate_acrea_entry))
        .route("/evaluate-acrea-entry-v4", post(evaluate_acrea_entry_v4))
}

async fn evaluate_acrea_entry_v4(
    Json(input): Json<ACREAEntryLevelTestInput>,
) -> Result<Json<super::model::ACREAEntryLevelTestResult>, AppError> {
    Ok(Json(service::evaluate_acrea_entry_v4(input)?))
}

async fn evaluate_acrea_entry(
    Json(input): Json<ACREAEntryLevelTestInput>,
) -> Result<Json<super::model::ACREAEntryLevelTestResult>, AppError> {
    Ok(Json(service::evaluate_acrea_entry(input)?))
}
