use axum::{Json, Router, extract::State, routing::post};

use crate::shared::{error::AppError, state::AppState};
use weekly_ai_core::{WeeklyProgram, WeeklyProgramAiInput};

pub fn routes() -> Router<AppState> {
    Router::new().route("/weekly-program", post(generate_weekly_program))
}

async fn generate_weekly_program(
    State(state): State<AppState>,
    Json(request): Json<WeeklyProgramAiInput>,
) -> Result<Json<WeeklyProgram>, AppError> {
    Ok(Json(state.weekly_program_generator.generate(&request)?))
}
