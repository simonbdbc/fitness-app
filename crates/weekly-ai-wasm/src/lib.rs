use burn::{
    backend::{Flex, flex::FlexDevice},
    module::Module,
    record::{NoStdInferenceRecorder, Recorder},
};
use wasm_bindgen::prelude::*;
use weekly_ai_core::{
    BurnSessionScorer, WeeklyProgramAiInput, WorkoutScorer, generate_weekly_program,
    generate_weekly_program_with_scorer,
};

static MODEL_BYTES: &[u8] = include_bytes!("../assets/weekly_scorer_v1.bin");

#[wasm_bindgen]
pub fn generate_weekly_program_json(input_json: &str) -> Result<String, JsValue> {
    let input = parse_input(input_json)?;
    let device = FlexDevice::default();
    let record = NoStdInferenceRecorder::new()
        .load(MODEL_BYTES, &device)
        .map_err(|error| js_error("unable to load weekly scorer weights", error))?;
    let model = WorkoutScorer::<Flex>::new(&device).load_record(record);
    let scorer = BurnSessionScorer::new(model, device);
    let program = generate_weekly_program_with_scorer(&input, &scorer)
        .map_err(|error| js_error("unable to generate weekly program", error))?;

    serialize_program(&program)
}

#[wasm_bindgen]
pub fn generate_weekly_program_rules_json(input_json: &str) -> Result<String, JsValue> {
    let input = parse_input(input_json)?;
    let program = generate_weekly_program(&input)
        .map_err(|error| js_error("unable to generate weekly program", error))?;

    serialize_program(&program)
}

fn parse_input(input_json: &str) -> Result<WeeklyProgramAiInput, JsValue> {
    serde_json::from_str(input_json)
        .map_err(|error| js_error("invalid weekly program input", error))
}

fn serialize_program(program: &weekly_ai_core::WeeklyProgram) -> Result<String, JsValue> {
    serde_json::to_string(program)
        .map_err(|error| js_error("unable to serialize weekly program", error))
}

fn js_error(context: &str, error: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&format!("{context}: {error}"))
}
