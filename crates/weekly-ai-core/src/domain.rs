use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Pillar {
    Strength,
    Cardio,
    Proprioception,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ObjectiveCode {
    Complete,
    Strength,
    Cardio,
    Proprioception,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EquipmentMode {
    Aucun,
    Mixte,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionPhase {
    Warmup,
    Main,
    Cooldown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PrescriptionKind {
    Repetitions,
    Intervals,
    Fixed,
}

impl Pillar {
    pub const ALL: [Self; 3] = [Self::Strength, Self::Cardio, Self::Proprioception];
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct PillarLevels {
    pub strength: u8,
    pub cardio: u8,
    pub proprioception: u8,
}

impl PillarLevels {
    pub fn get(&self, pillar: Pillar) -> u8 {
        match pillar {
            Pillar::Strength => self.strength,
            Pillar::Cardio => self.cardio,
            Pillar::Proprioception => self.proprioception,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct UserProfile {
    pub id: String,
    pub objective_code: ObjectiveCode,
    pub equipment_mode: EquipmentMode,
    pub weekly_frequency: u8,
    pub session_minutes_min: u16,
    pub session_minutes_max: u16,
    pub weekly_novelty_percent: u8,
    pub level_test_completed: bool,
    pub level_test_version: u16,
    pub pillar_levels: PillarLevels,
    #[serde(default)]
    pub available_equipment: Vec<String>,
    #[serde(default)]
    pub preferred_weekdays: Vec<u8>,
    #[serde(default)]
    pub restrictions: Vec<StructuredRestriction>,
    #[serde(default)]
    pub excluded_exercise_codes: Vec<String>,
}

impl UserProfile {
    pub fn low_impact(&self) -> bool {
        self.restrictions
            .iter()
            .any(|restriction| matches!(restriction, StructuredRestriction::ImpactLimit { maximum_impact } if maximum_impact == "faible"))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
#[serde(deny_unknown_fields)]
pub enum StructuredRestriction {
    ImpactLimit { maximum_impact: String },
    ExerciseExclusion { exercise_code: String },
    PillarLimit { pillar: Pillar, maximum_level: u8 },
    EquipmentExclusion { equipment_code: String },
    TemporaryPain { muscle_group_codes: Vec<String> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
#[serde(deny_unknown_fields)]
pub enum EquipmentOption {
    Bodyweight,
    Equipment { equipment_codes: Vec<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct RecentStats {
    pub success_rate: f32,
    pub fatigue: f32,
    pub skipped_sessions: u8,
    #[serde(default)]
    pub pain_rate: f32,
    #[serde(default)]
    pub progression_needed: bool,
    #[serde(default)]
    pub regression_needed: bool,
}

impl Default for RecentStats {
    fn default() -> Self {
        Self {
            success_rate: 0.75,
            fatigue: 0.35,
            skipped_sessions: 0,
            pain_rate: 0.0,
            progression_needed: false,
            regression_needed: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct CandidateRecentStats {
    pub session_template_id: u32,
    pub exercise_id: u32,
    pub format_id: u32,
    pub stats: RecentStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct CatalogCandidate {
    pub session_template_id: u32,
    pub exercise_id: u32,
    pub exercise_code: String,
    pub exercise_name: String,
    pub format_id: u32,
    pub format_code: String,
    pub format_label: String,
    pub pillar: Pillar,
    pub phase: SessionPhase,
    pub prescription_kind: PrescriptionKind,
    pub level: u8,
    pub duration_seconds: u16,
    #[serde(default)]
    pub complete_exercise_sheet: bool,
    pub equipment_options: Vec<EquipmentOption>,
    pub muscle_group_codes: Vec<String>,
    pub impact_code: String,
    pub regression: Option<CandidateAlternative>,
    pub progression: Option<CandidateAlternative>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct CandidateAlternative {
    pub exercise_name: String,
    pub level: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct WeeklyProgramAiInput {
    pub schema_version: u8,
    pub profile: UserProfile,
    pub candidates: Vec<CatalogCandidate>,
    #[serde(default)]
    pub recent_stats: RecentStats,
    #[serde(default)]
    pub candidate_recent_stats: Vec<CandidateRecentStats>,
    #[serde(default)]
    pub exercise_progressions: Vec<ExerciseProgression>,
    #[serde(default)]
    pub exercise_histories: Vec<ExerciseHistory>,
    pub iso_week_year: i32,
    pub iso_week_number: u8,
    pub catalog_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyProgram {
    pub schema_version: u8,
    pub iso_week_year: i32,
    pub iso_week_number: u8,
    pub catalog_version: String,
    pub role: String,
    pub validation_focus: String,
    pub generated_by: String,
    pub trainings: Vec<Training>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Training {
    pub code: String,
    pub day: String,
    pub title: String,
    pub dominant_pillar: Pillar,
    pub duration_minutes: u16,
    pub status: String,
    pub seances: Vec<Seance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Seance {
    pub code: String,
    pub phase: SessionPhase,
    pub pillar: Option<Pillar>,
    pub title: String,
    pub sessions: Vec<Session>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub code: String,
    pub session_template_id: u32,
    pub exercise_id: u32,
    pub exercise_code: String,
    pub exercise_name: String,
    pub format_id: u32,
    pub format_label: String,
    pub format_code: String,
    pub phase: SessionPhase,
    pub level: u8,
    pub prescription: SessionPrescription,
    pub easier: SessionAlternative,
    pub harder: SessionAlternative,
    pub safety_rule: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct SessionPrescription {
    pub kind: PrescriptionKind,
    pub series: u8,
    pub repetitions: Option<u8>,
    pub effort_seconds: Option<u16>,
    pub rest_seconds: u16,
    pub estimated_duration_seconds: u16,
    pub adaptable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct ExerciseProgression {
    pub exercise_id: u32,
    pub prescription: SessionPrescription,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct ExerciseHistory {
    pub exercise_id: u32,
    pub appreciation_average: Option<f32>,
    pub last_iso_week_year: Option<i32>,
    pub last_iso_week_number: Option<u8>,
    #[serde(default)]
    pub reached_maximum: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionAlternative {
    pub name: String,
    pub level: u8,
    pub note: String,
}
