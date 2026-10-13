use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use burn::{
    backend::{Autodiff, Flex},
    module::{AutodiffModule, Module},
    nn::loss::{MseLoss, Reduction},
    optim::{AdamConfig, GradientsParams, Optimizer},
    record::NoStdTrainingRecorder,
    tensor::{ElementConversion, Tensor, TensorData, backend::Backend},
};
use weekly_ai_core::{
    CatalogCandidate, EquipmentMode, EquipmentOption, FEATURE_COUNT, ObjectiveCode, Pillar,
    PillarLevels, RecentStats, UserProfile, WorkoutScorer, build_features, heuristic_score,
};

type TrainBackend = Autodiff<Flex>;

const EPOCHS: usize = 450;
const LEARNING_RATE: f64 = 0.015;
const MAX_ACCEPTABLE_MSE: f32 = 0.008;

fn main() -> Result<()> {
    let check_only = std::env::args().any(|argument| argument == "--check");
    let model_path = model_path();
    let samples = synthetic_dataset();

    if check_only {
        let model = load_model(&model_path)?;
        let mse = evaluate(&model, &samples);
        println!("weekly_scorer_v1: {} samples, mse={mse:.6}", samples.len());
        if mse > MAX_ACCEPTABLE_MSE {
            bail!("distilled model MSE {mse:.6} exceeds {MAX_ACCEPTABLE_MSE:.6}");
        }
        return Ok(());
    }

    let model = train(&samples);
    let mse = evaluate(&model, &samples);
    if mse > MAX_ACCEPTABLE_MSE {
        bail!("training MSE {mse:.6} exceeds {MAX_ACCEPTABLE_MSE:.6}");
    }

    model
        .save_file(&model_path, &NoStdTrainingRecorder::new())
        .context("failed to write no-std compatible scorer weights")?;
    println!(
        "wrote {}.bin ({} samples, mse={mse:.6})",
        model_path.display(),
        samples.len(),
    );
    Ok(())
}

fn train(samples: &[SyntheticSample]) -> WorkoutScorer<Flex> {
    let device = Default::default();
    <TrainBackend as Backend>::seed(&device, 42);
    let mut model = WorkoutScorer::<TrainBackend>::new(&device);
    let mut optimizer = AdamConfig::new().init();
    let (inputs, targets) = training_tensors::<TrainBackend>(samples, &device);
    let loss = MseLoss::new();

    for _ in 0..EPOCHS {
        let output = model.forward(inputs.clone());
        let loss_value = loss.forward(output, targets.clone(), Reduction::Mean);
        let gradients = GradientsParams::from_grads(loss_value.backward(), &model);
        model = optimizer.step(LEARNING_RATE, model, gradients);
    }

    model.valid()
}

fn evaluate(model: &WorkoutScorer<Flex>, samples: &[SyntheticSample]) -> f32 {
    let device = Default::default();
    let (inputs, targets) = training_tensors::<Flex>(samples, &device);
    MseLoss::new()
        .forward(model.forward(inputs), targets, Reduction::Mean)
        .into_scalar()
        .elem::<f32>()
}

fn load_model(path: &Path) -> Result<WorkoutScorer<Flex>> {
    let bin_path = path.with_extension("bin");
    if !bin_path.exists() {
        bail!(
            "{} is missing; run weekly-ai-train without --check first",
            bin_path.display(),
        );
    }

    let device = Default::default();
    WorkoutScorer::<Flex>::new(&device)
        .load_file(path, &NoStdTrainingRecorder::new(), &device)
        .context("failed to load weekly_scorer_v1.bin")
}

fn training_tensors<B: Backend>(
    samples: &[SyntheticSample],
    device: &B::Device,
) -> (Tensor<B, 2>, Tensor<B, 2>) {
    let mut features = Vec::with_capacity(samples.len() * FEATURE_COUNT);
    let mut targets = Vec::with_capacity(samples.len());
    for sample in samples {
        features.extend_from_slice(&sample.features);
        targets.push(sample.target);
    }

    (
        Tensor::from_data(
            TensorData::new(features, [samples.len(), FEATURE_COUNT]),
            device,
        ),
        Tensor::from_data(TensorData::new(targets, [samples.len(), 1]), device),
    )
}

#[derive(Clone)]
struct SyntheticSample {
    features: [f32; FEATURE_COUNT],
    target: f32,
}

fn synthetic_dataset() -> Vec<SyntheticSample> {
    let mut samples = Vec::new();
    let user_levels = [1_u8, 3, 5, 8, 10];
    let fatigue_levels = [0.1_f32, 0.45, 0.8];
    let success_rates = [0.4_f32, 0.75, 0.95];

    for pillar in Pillar::ALL {
        for user_level in user_levels {
            for level_delta in [-1_i8, 0, 1] {
                let candidate_level = (user_level as i16 + level_delta as i16).clamp(1, 10) as u8;
                for fatigue in fatigue_levels {
                    for success_rate in success_rates {
                        for low_impact in [false, true] {
                            for equipment_match in [false, true] {
                                let profile = synthetic_profile(
                                    pillar,
                                    user_level,
                                    low_impact,
                                    equipment_match,
                                );
                                let stats = RecentStats {
                                    success_rate,
                                    fatigue,
                                    skipped_sessions: if success_rate < 0.5 { 2 } else { 0 },
                                    pain_rate: if fatigue > 0.75 { 0.25 } else { 0.0 },
                                    progression_needed: success_rate > 0.85 && fatigue < 0.5,
                                    regression_needed: success_rate < 0.5 || fatigue > 0.7,
                                };
                                let candidate = synthetic_candidate(pillar, candidate_level);
                                let features = build_features(&candidate, &profile, &stats);
                                samples.push(SyntheticSample {
                                    target: heuristic_score(&features),
                                    features,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    samples
}

fn synthetic_profile(
    pillar: Pillar,
    level: u8,
    low_impact: bool,
    equipment_match: bool,
) -> UserProfile {
    let mut pillar_levels = PillarLevels {
        strength: 4,
        cardio: 4,
        proprioception: 4,
    };
    match pillar {
        Pillar::Strength => pillar_levels.strength = level,
        Pillar::Cardio => pillar_levels.cardio = level,
        Pillar::Proprioception => pillar_levels.proprioception = level,
    }

    UserProfile {
        id: "synthetic".into(),
        equipment_mode: EquipmentMode::Mixte,
        weekly_frequency: 3,
        session_minutes_min: 30,
        session_minutes_max: 45,
        weekly_novelty_percent: 50,
        level_test_completed: true,
        level_test_version: 2,
        pillar_levels,
        available_equipment: if equipment_match {
            vec!["mur".into()]
        } else {
            vec!["sol".into()]
        },
        objective_code: ObjectiveCode::Complete,
        preferred_weekdays: vec![1, 3, 5],
        restrictions: if low_impact {
            vec![weekly_ai_core::StructuredRestriction::ImpactLimit {
                maximum_impact: "faible".into(),
            }]
        } else {
            vec![]
        },
        excluded_exercise_codes: vec![],
    }
}

fn synthetic_candidate(pillar: Pillar, level: u8) -> CatalogCandidate {
    CatalogCandidate {
        session_template_id: level as u32,
        exercise_id: level as u32,
        exercise_code: format!("synthetic-{level}"),
        exercise_name: format!("Synthetic {level}"),
        format_id: 1,
        format_code: "synthetic-format".into(),
        format_label: "3 x 8".into(),
        pillar,
        phase: weekly_ai_core::SessionPhase::Main,
        prescription_kind: if pillar == Pillar::Cardio {
            weekly_ai_core::PrescriptionKind::Intervals
        } else {
            weekly_ai_core::PrescriptionKind::Repetitions
        },
        level,
        duration_seconds: 300,
        complete_exercise_sheet: true,
        equipment_options: vec![EquipmentOption::Equipment {
            equipment_codes: vec!["mur".into()],
        }],
        muscle_group_codes: vec!["pecs".into()],
        impact_code: "faible".into(),
        regression: None,
        progression: None,
    }
}

fn model_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../weekly-ai-wasm/assets/weekly_scorer_v1")
}
