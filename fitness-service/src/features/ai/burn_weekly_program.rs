use crate::shared::error::AppError;
use burn::{
    backend::{Flex, flex::FlexDevice},
    module::Module,
    record::{NoStdInferenceRecorder, Recorder},
};
use weekly_ai_core::{
    BurnSessionScorer, WeeklyProgram, WeeklyProgramAiInput, WorkoutScorer, generate_weekly_program,
    generate_weekly_program_with_scorer,
};

static MODEL_BYTES: &[u8] =
    include_bytes!("../../../../crates/weekly-ai-wasm/assets/weekly_scorer_v1.bin");

#[derive(Debug)]
pub struct BurnWeeklyProgramGenerator;

impl BurnWeeklyProgramGenerator {
    pub fn new() -> Self {
        Self
    }

    pub fn generate(&self, input: &WeeklyProgramAiInput) -> Result<WeeklyProgram, AppError> {
        let device = FlexDevice::default();
        if let Ok(record) = NoStdInferenceRecorder::new().load(MODEL_BYTES, &device) {
            let model = WorkoutScorer::<Flex>::new(&device).load_record(record);
            let scorer = BurnSessionScorer::new(model, device);
            if let Ok(program) = generate_weekly_program_with_scorer(input, &scorer) {
                return Ok(program);
            }
        }

        generate_weekly_program(input).map_err(|error| AppError::Validation(error.to_string()))
    }
}
