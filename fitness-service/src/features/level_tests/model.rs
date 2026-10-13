use serde::{Deserialize, Serialize};

use crate::features::profiles::PillarLevels;

#[derive(Debug, Deserialize)]
pub struct ACREAEntryExerciseScore {
    pub exercise_code: String,
    pub stages: Vec<ACREAEntryStageResult>,
}

#[derive(Debug, Deserialize)]
pub struct ACREAEntryStageResult {
    pub stage: u8,
    pub technical_valid: bool,
    pub maximum_repetitions: Option<u16>,
}

#[derive(Debug, Deserialize)]
pub struct ACREAEntryLevelTestInput {
    pub scores: Vec<ACREAEntryExerciseScore>,
}

#[derive(Debug, Serialize)]
pub struct ACREAEntryExerciseResult {
    pub exercise_code: String,
    pub pillar: &'static str,
    pub value: u16,
    pub unit: &'static str,
    pub level: u8,
    pub counted: bool,
}

#[derive(Debug, Serialize)]
pub struct ACREAEntryLevelTestResult {
    pub recommendation: String,
    pub pillar_levels: PillarLevels,
    pub weakest_pillars: Vec<&'static str>,
    pub warnings: Vec<String>,
    pub exercise_results: Vec<ACREAEntryExerciseResult>,
}
