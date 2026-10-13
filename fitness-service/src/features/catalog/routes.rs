use axum::{Json, Router, extract::State, routing::get};

use crate::features::catalog::repository;
use crate::shared::{error::AppError, state::AppState};

pub fn routes() -> Router<AppState> {
    Router::new().route("/exercises", get(list_exercises))
}

async fn list_exercises(
    State(state): State<AppState>,
) -> Result<Json<Vec<super::model::Exercise>>, AppError> {
    let exercises = repository::list_exercises(&state.pool).await?;
    Ok(Json(exercises))
}
