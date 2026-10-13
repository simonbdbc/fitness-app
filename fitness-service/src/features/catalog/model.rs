use serde::Serialize;
use serde_json::Value;
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Exercise {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub pillar_id: i64,
    pub pillar_code: String,
    pub pillar_label: String,
    pub family: Value,
    pub families: Value,
    pub exercise_type: Value,
    pub muscle_groups: Value,
    pub level_min: i16,
    pub level_max: i16,
    pub equipment: String,
    pub impact: Option<String>,
    pub regression: Option<String>,
    pub progression: String,
    pub description: String,
    pub start_position_steps: Value,
    pub outbound_execution_steps: Value,
    pub return_execution_steps: Value,
    pub position_steps: Value,
    pub execution_steps: Value,
    pub common_errors: Value,
    pub source_status: String,
    pub updated_at: String,
}
