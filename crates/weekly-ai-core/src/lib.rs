mod domain;
mod features;
mod generator;
mod model;
mod progression;

pub use domain::*;
pub use features::{FEATURE_COUNT, build_features, heuristic_score};
pub use generator::{
    GenerateWeeklyProgramError, SessionScorer, generate_weekly_program,
    generate_weekly_program_with_scorer,
};
pub use model::{BurnSessionScorer, WorkoutScorer};
pub use progression::{
    easier_prescription, fixed_prescription, harder_prescription, initial_prescription,
    longer_prescription, prescription_at_maximum,
};
