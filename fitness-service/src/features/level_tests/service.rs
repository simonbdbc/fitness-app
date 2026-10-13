use crate::features::level_tests::model::{
    ACREAEntryExerciseResult, ACREAEntryLevelTestInput, ACREAEntryLevelTestResult,
};
use crate::features::profiles::PillarLevels;
use crate::shared::error::AppError;
use serde::Deserialize;

pub fn evaluate_acrea_entry(
    input: ACREAEntryLevelTestInput,
) -> Result<ACREAEntryLevelTestResult, AppError> {
    evaluate_acrea_entry_with_specs(
        input,
        ACREA_ENTRY_TEST_EXERCISES
            .iter()
            .map(|exercise| ResolvedExerciseSpec {
                code: exercise.code.to_owned(),
                pillar: exercise.pillar,
                level_2_minimum: 6,
                level_3_minimum: 11,
            })
            .collect(),
    )
}

pub fn evaluate_acrea_entry_v4(
    input: ACREAEntryLevelTestInput,
) -> Result<ACREAEntryLevelTestResult, AppError> {
    let manifest: ACREALevelEvaluationManifest = serde_json::from_str(include_str!(
        "../../../../contracts/catalog/acrea-level-evaluation-v4.json"
    ))
    .map_err(|error| AppError::Validation(format!("invalid ACREA V4 manifest: {error}")))?;
    if manifest.protocol_version != 4
        || manifest.catalog_release_code != "exercise-library-v2"
        || manifest.exercises.len() != 6
    {
        return Err(AppError::Validation(
            "incompatible ACREA V4 manifest".to_owned(),
        ));
    }
    let specs = manifest
        .exercises
        .into_iter()
        .map(|exercise| {
            Ok(ResolvedExerciseSpec {
                code: exercise.evaluation_exercise_code,
                pillar: require_pillar(&exercise.pillar)?,
                level_2_minimum: exercise.level_thresholds.level_2_minimum,
                level_3_minimum: exercise.level_thresholds.level_3_minimum,
            })
        })
        .collect::<Result<Vec<_>, AppError>>()?;
    evaluate_acrea_entry_with_specs(input, specs)
}

fn evaluate_acrea_entry_with_specs(
    input: ACREAEntryLevelTestInput,
    exercises: Vec<ResolvedExerciseSpec>,
) -> Result<ACREAEntryLevelTestResult, AppError> {
    let mut exercise_results = Vec::with_capacity(exercises.len());
    let warnings = Vec::new();

    for exercise in exercises {
        let matching_scores = input
            .scores
            .iter()
            .filter(|score| score.exercise_code == exercise.code)
            .collect::<Vec<_>>();

        if matching_scores.is_empty() {
            return Err(AppError::Validation(format!(
                "missing ACREA entry score for {}",
                exercise.code
            )));
        }

        if matching_scores.len() > 1 {
            return Err(AppError::Validation(format!(
                "duplicate ACREA entry score for {}",
                exercise.code
            )));
        }

        let score = matching_scores[0];
        for stage in 1..=3 {
            let matches = score
                .stages
                .iter()
                .filter(|result| result.stage == stage)
                .collect::<Vec<_>>();
            if matches.len() != 1 || !matches[0].technical_valid {
                return Err(AppError::Validation(format!(
                    "{} stage {} must be present once and technically valid",
                    exercise.code, stage
                )));
            }
        }
        let value = score
            .stages
            .iter()
            .find(|result| result.stage == 3)
            .and_then(|result| result.maximum_repetitions)
            .ok_or_else(|| {
                AppError::Validation(format!(
                    "{} stage 3 requires maximum_repetitions",
                    exercise.code
                ))
            })?;
        let counted = true;

        exercise_results.push(ACREAEntryExerciseResult {
            exercise_code: exercise.code,
            pillar: exercise.pillar,
            value,
            unit: "reps",
            level: score_entry_reps(value, exercise.level_2_minimum, exercise.level_3_minimum),
            counted,
        });
    }

    let evaluated_pillar_levels = calculate_pillar_levels(&exercise_results);
    let pillar_levels = evaluated_pillar_levels;
    let weakest_pillars = weakest_pillars(&pillar_levels);
    let recommendation = acrea_entry_recommendation(&weakest_pillars, Some(&pillar_levels));

    Ok(ACREAEntryLevelTestResult {
        recommendation,
        pillar_levels,
        weakest_pillars,
        warnings,
        exercise_results,
    })
}

fn score_entry_reps(value: u16, level_2_minimum: u16, level_3_minimum: u16) -> u8 {
    if value < level_2_minimum {
        1
    } else if value < level_3_minimum {
        2
    } else {
        3
    }
}

struct ACREAEntryExerciseSpec {
    code: &'static str,
    pillar: &'static str,
}

const ACREA_ENTRY_TEST_EXERCISES: [ACREAEntryExerciseSpec; 6] = [
    ACREAEntryExerciseSpec {
        code: "renforcement-strict-pushups",
        pillar: "strength",
    },
    ACREAEntryExerciseSpec {
        code: "renforcement-bodyweight-squats",
        pillar: "strength",
    },
    ACREAEntryExerciseSpec {
        code: "cardio-burpee-sans-pompe",
        pillar: "cardio",
    },
    ACREAEntryExerciseSpec {
        code: "cardio-mountain-climber-controle",
        pillar: "cardio",
    },
    ACREAEntryExerciseSpec {
        code: "proprioception-leg-raise",
        pillar: "proprioception",
    },
    ACREAEntryExerciseSpec {
        code: "proprioception-inverted-row",
        pillar: "proprioception",
    },
];

struct ResolvedExerciseSpec {
    code: String,
    pillar: &'static str,
    level_2_minimum: u16,
    level_3_minimum: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ACREALevelEvaluationManifest {
    protocol_version: u8,
    catalog_release_code: String,
    exercises: Vec<ACREALevelEvaluationManifestExercise>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ACREALevelEvaluationManifestExercise {
    evaluation_exercise_code: String,
    pillar: String,
    level_thresholds: ACREALevelEvaluationThresholds,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ACREALevelEvaluationThresholds {
    level_2_minimum: u16,
    level_3_minimum: u16,
}

fn require_pillar(value: &str) -> Result<&'static str, AppError> {
    match value {
        "strength" => Ok("strength"),
        "cardio" => Ok("cardio"),
        "proprioception" => Ok("proprioception"),
        _ => Err(AppError::Validation(format!(
            "invalid ACREA V4 pillar: {value}"
        ))),
    }
}

fn calculate_pillar_levels(results: &[ACREAEntryExerciseResult]) -> PillarLevels {
    PillarLevels {
        strength: lowest_pillar_level(results, "strength"),
        cardio: lowest_pillar_level(results, "cardio"),
        proprioception: lowest_pillar_level(results, "proprioception"),
    }
}

fn lowest_pillar_level(results: &[ACREAEntryExerciseResult], pillar: &str) -> u8 {
    results
        .iter()
        .filter(|result| result.pillar == pillar)
        .map(|result| result.level)
        .min()
        .unwrap_or(1)
}

fn weakest_pillars(pillar_levels: &PillarLevels) -> Vec<&'static str> {
    let weakest_level = [
        pillar_levels.strength,
        pillar_levels.cardio,
        pillar_levels.proprioception,
    ]
    .into_iter()
    .min()
    .unwrap_or(1);
    let mut pillars = Vec::new();

    if pillar_levels.strength == weakest_level {
        pillars.push("strength");
    }
    if pillar_levels.cardio == weakest_level {
        pillars.push("cardio");
    }
    if pillar_levels.proprioception == weakest_level {
        pillars.push("proprioception");
    }

    pillars
}

fn acrea_entry_recommendation(
    weakest_pillars: &[&'static str],
    evaluated_pillar_levels: Option<&PillarLevels>,
) -> String {
    let mut message = format!(
        "Le programme hebdomadaire utilise les niveaux validés. Pilier le plus prudent: {}.",
        weakest_pillars.join(", ")
    );

    if let Some(levels) = evaluated_pillar_levels {
        message.push_str(&format!(
            " Résultats évalués conservés pour recommandation: renforcement {}, cardio {}, proprioception {}.",
            levels.strength, levels.cardio, levels.proprioception
        ));
    }

    message
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::level_tests::model::{ACREAEntryExerciseScore, ACREAEntryStageResult};

    #[test]
    fn v4_uses_the_shared_canonical_manifest() {
        let scores = [
            ("renforcement-strict-pushups", 20),
            ("renforcement-bodyweight-squats", 80),
            ("cardio-burpee-sans-pompe", 20),
            ("cardio-mountain-climber-controle", 90),
            ("proprioception-leg-raise", 20),
            ("proprioception-planche-lean", 30),
        ]
        .into_iter()
        .map(|(exercise_code, maximum)| ACREAEntryExerciseScore {
            exercise_code: exercise_code.to_owned(),
            stages: vec![
                valid_stage(1, None),
                valid_stage(2, None),
                valid_stage(3, Some(maximum)),
            ],
        })
        .collect();

        let result = evaluate_acrea_entry_v4(ACREAEntryLevelTestInput { scores })
            .expect("the V4 manifest should evaluate");

        assert_eq!(result.exercise_results.len(), 6);
        assert!(
            result
                .exercise_results
                .iter()
                .any(|exercise| { exercise.exercise_code == "proprioception-planche-lean" })
        );
        assert!(
            !result
                .exercise_results
                .iter()
                .any(|exercise| { exercise.exercise_code == "proprioception-inverted-row" })
        );
        assert_eq!(result.pillar_levels.strength, 2);
        assert_eq!(result.pillar_levels.cardio, 2);
        assert_eq!(result.pillar_levels.proprioception, 2);
        assert!(
            ACREA_ENTRY_TEST_EXERCISES
                .iter()
                .any(|exercise| { exercise.code == "proprioception-inverted-row" })
        );
    }

    fn valid_stage(stage: u8, maximum_repetitions: Option<u16>) -> ACREAEntryStageResult {
        ACREAEntryStageResult {
            stage,
            technical_valid: true,
            maximum_repetitions,
        }
    }
}
