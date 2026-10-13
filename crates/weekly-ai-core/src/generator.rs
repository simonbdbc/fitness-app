use std::{
    cmp::Ordering,
    collections::{HashMap, HashSet},
};

use thiserror::Error;

use crate::{
    CatalogCandidate, EquipmentMode, EquipmentOption, FEATURE_COUNT, ObjectiveCode, Pillar,
    PrescriptionKind, Session, SessionAlternative, SessionPhase, SessionPrescription,
    StructuredRestriction, Training, WeeklyProgram, WeeklyProgramAiInput, build_features,
    fixed_prescription, heuristic_score, initial_prescription, longer_prescription,
};

const GENERATED_BY_RULES: &str = "acrea-rules-v3";
const GENERATED_BY_BURN: &str = "burn-flex:weekly-scorer-v1+acrea-v3";
const FIXED_PHASE_SECONDS: u16 = 300;
const MAIN_RECOVERY_SECONDS: u32 = 90;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum GenerateWeeklyProgramError {
    #[error("ACREA level evaluation v3 must be completed before generating a weekly program")]
    LevelTestRequired,
    #[error("weeklyFrequency must be between 1 and 7")]
    InvalidWeeklyFrequency,
    #[error(
        "sessionMinutesMin/sessionMinutesMax must use 5-minute steps between 20 and 180 with a gap of at least 5 minutes"
    )]
    InvalidTargetDuration,
    #[error("weeklyNoveltyPercent must be between 0 and 100 in steps of 10")]
    InvalidNoveltyPercent,
    #[error("profile levels must be between 1 and 10")]
    InvalidProfileLevel,
    #[error("profile identity, objective, equipment mode, equipment or exclusions are invalid")]
    InvalidProfile,
    #[error("schemaVersion must be 3")]
    InvalidSchemaVersion,
    #[error("isoWeekNumber must be between 1 and 53")]
    InvalidIsoWeek,
    #[error("isoWeekYear must be between 1970 and 9999")]
    InvalidIsoWeekYear,
    #[error("catalogVersion must not be empty")]
    InvalidCatalogVersion,
    #[error("preferredWeekdays must contain unique values between 1 and 7")]
    InvalidPreferredWeekday,
    #[error("recent stats must be finite and normalized")]
    InvalidRecentStats,
    #[error("at least one valid catalog candidate is required")]
    InvalidCandidate,
    #[error("profile restrictions are invalid")]
    InvalidRestriction,
    #[error("exercise progression or history is invalid")]
    InvalidExerciseState,
    #[error("no eligible candidate for phase {0:?}")]
    MissingPhaseCandidate(SessionPhase),
    #[error("no eligible candidate for pillar {0:?}")]
    MissingPillarCandidate(Pillar),
    #[error(
        "eligible exercises cannot reach sessionMinutesMin without exceeding sessionMinutesMax"
    )]
    InsufficientDuration,
}

pub trait SessionScorer {
    fn score(&self, features: [f32; FEATURE_COUNT]) -> f32;
}

struct HeuristicSessionScorer;

impl SessionScorer for HeuristicSessionScorer {
    fn score(&self, features: [f32; FEATURE_COUNT]) -> f32 {
        heuristic_score(&features)
    }
}

pub fn generate_weekly_program(
    input: &WeeklyProgramAiInput,
) -> Result<WeeklyProgram, GenerateWeeklyProgramError> {
    generate(input, &HeuristicSessionScorer, GENERATED_BY_RULES)
}

pub fn generate_weekly_program_with_scorer(
    input: &WeeklyProgramAiInput,
    scorer: &impl SessionScorer,
) -> Result<WeeklyProgram, GenerateWeeklyProgramError> {
    generate(input, scorer, GENERATED_BY_BURN)
}

fn generate(
    input: &WeeklyProgramAiInput,
    scorer: &impl SessionScorer,
    generated_by: &str,
) -> Result<WeeklyProgram, GenerateWeeklyProgramError> {
    validate_input(input)?;

    let warmup = select_fixed_phase(input, SessionPhase::Warmup)?;
    let cooldown = select_fixed_phase(input, SessionPhase::Cooldown)?;
    let selected_main =
        select_main_composition(input, scorer, [warmup.exercise_id, cooldown.exercise_id])?;
    let total_seconds =
        FIXED_PHASE_SECONDS as u32 * 2 + selected_main.iter().map(main_slot_duration).sum::<u32>();
    let duration_minutes = total_seconds.div_ceil(60) as u16;
    if duration_minutes < input.profile.session_minutes_min
        || duration_minutes > input.profile.session_minutes_max
    {
        return Err(GenerateWeeklyProgramError::InsufficientDuration);
    }

    let dominant_pillar = focused_pillar(input.profile.objective_code).unwrap_or(Pillar::Strength);
    let trainings = (0..input.profile.weekly_frequency as usize)
        .map(|index| Training {
            code: format!("T{}", index + 1),
            day: preferred_day(&input.profile.preferred_weekdays, index).to_string(),
            title: "Séance ACREA complète".into(),
            dominant_pillar,
            duration_minutes,
            status: "a faire".into(),
            seances: build_daily_seances(input, warmup, cooldown, &selected_main, index),
        })
        .collect();

    Ok(WeeklyProgram {
        schema_version: 3,
        iso_week_year: input.iso_week_year,
        iso_week_number: input.iso_week_number,
        catalog_version: input.catalog_version.clone(),
        role: "Programme issu de l’évaluation de niveau ACREA".into(),
        validation_focus:
            "Technique, douleur, appréciation et adaptation des exercices principaux.".into(),
        generated_by: generated_by.into(),
        trainings,
    })
}

#[derive(Clone)]
struct SelectedMain<'a> {
    candidate: &'a CatalogCandidate,
    prescription: SessionPrescription,
    score: f32,
    appreciation_average: Option<f32>,
    last_practiced: Option<(i32, u8)>,
}

fn main_slot_duration(selected: &SelectedMain<'_>) -> u32 {
    selected.prescription.estimated_duration_seconds as u32 + MAIN_RECOVERY_SECONDS
}

fn select_fixed_phase(
    input: &WeeklyProgramAiInput,
    phase: SessionPhase,
) -> Result<&CatalogCandidate, GenerateWeeklyProgramError> {
    input
        .candidates
        .iter()
        .filter(|candidate| candidate.phase == phase)
        .filter(|candidate| fixed_candidate_allowed(input, candidate))
        .min_by(|left, right| {
            compare_complete_sheet_first(left, right)
                .then_with(|| left.level.cmp(&right.level))
                .then_with(|| compare_candidate_stable(left, right))
        })
        .ok_or(GenerateWeeklyProgramError::MissingPhaseCandidate(phase))
}

fn select_main_composition<'a>(
    input: &'a WeeklyProgramAiInput,
    scorer: &impl SessionScorer,
    reserved_exercise_ids: [u32; 2],
) -> Result<Vec<SelectedMain<'a>>, GenerateWeeklyProgramError> {
    let histories = input
        .exercise_histories
        .iter()
        .map(|history| (history.exercise_id, history))
        .collect::<HashMap<_, _>>();
    let mut eligible = input
        .candidates
        .iter()
        .filter(|candidate| candidate.phase == SessionPhase::Main)
        .filter(|candidate| !reserved_exercise_ids.contains(&candidate.exercise_id))
        .filter(|candidate| {
            maximum_history_is_available(input, histories.get(&candidate.exercise_id).copied())
        })
        .filter(|candidate| {
            candidate_allowed(input, candidate, progression_blocked(input, candidate))
        })
        .map(|candidate| {
            let stats = stats_for_candidate(input, candidate);
            let history = histories.get(&candidate.exercise_id).copied();
            let score = scorer.score(build_features(candidate, &input.profile, stats))
                + objective_bonus(input.profile.objective_code, candidate.pillar);
            SelectedMain {
                candidate,
                prescription: progression_for(input, candidate),
                score,
                appreciation_average: history.and_then(|value| value.appreciation_average),
                last_practiced: history
                    .and_then(|value| value.last_iso_week_year.zip(value.last_iso_week_number)),
            }
        })
        .collect::<Vec<_>>();

    eligible.sort_by(|left, right| {
        compare_complete_sheet_first(left.candidate, right.candidate)
            .then_with(|| {
                low_impact_regression_fallback(input, left.candidate)
                    .cmp(&low_impact_regression_fallback(input, right.candidate))
            })
            .then_with(|| right.score.total_cmp(&left.score))
            .then_with(|| compare_candidate_stable(left.candidate, right.candidate))
    });

    let min_main_seconds = input.profile.session_minutes_min as u32 * 60 - 600;
    let max_main_seconds = input.profile.session_minutes_max as u32 * 60 - 600;
    let shares = objective_shares(input.profile.objective_code);
    let mut selected = Vec::<SelectedMain>::new();
    let mut used_exercises = HashSet::<u32>::new();
    let mut pillar_seconds = HashMap::<Pillar, u32>::new();
    let mut pillar_slots = HashMap::<Pillar, usize>::new();
    let mut total_seconds = 0_u32;

    for pillar in Pillar::ALL {
        let prefer_novelty = novelty_slot(
            pillar_slots.get(&pillar).copied().unwrap_or(0) + 1,
            input.profile.weekly_novelty_percent,
        );
        let Some(candidate) = pick_main_slot(
            &eligible,
            pillar,
            &used_exercises,
            total_seconds,
            max_main_seconds,
            prefer_novelty,
        ) else {
            return Err(GenerateWeeklyProgramError::MissingPillarCandidate(pillar));
        };
        let duration = main_slot_duration(candidate);
        if total_seconds + duration > max_main_seconds {
            return Err(GenerateWeeklyProgramError::InsufficientDuration);
        }
        selected.push(candidate.clone());
        used_exercises.insert(candidate.candidate.exercise_id);
        *pillar_seconds.entry(pillar).or_default() += duration;
        *pillar_slots.entry(pillar).or_default() += 1;
        total_seconds += duration;
    }

    while total_seconds < min_main_seconds {
        let desired_pillar = Pillar::ALL
            .into_iter()
            .max_by(|left, right| {
                let left_deficit = shares[left] * min_main_seconds as f32
                    - *pillar_seconds.get(left).unwrap_or(&0) as f32;
                let right_deficit = shares[right] * min_main_seconds as f32
                    - *pillar_seconds.get(right).unwrap_or(&0) as f32;
                left_deficit.total_cmp(&right_deficit)
            })
            .unwrap_or(Pillar::Strength);
        let next = pick_main_slot(
            &eligible,
            desired_pillar,
            &used_exercises,
            total_seconds,
            max_main_seconds,
            novelty_slot(
                pillar_slots.get(&desired_pillar).copied().unwrap_or(0) + 1,
                input.profile.weekly_novelty_percent,
            ),
        )
        .or_else(|| {
            Pillar::ALL.into_iter().find_map(|pillar| {
                pick_main_slot(
                    &eligible,
                    pillar,
                    &used_exercises,
                    total_seconds,
                    max_main_seconds,
                    novelty_slot(
                        pillar_slots.get(&pillar).copied().unwrap_or(0) + 1,
                        input.profile.weekly_novelty_percent,
                    ),
                )
            })
        });
        let Some(next) = next else {
            if let Some(duration_delta) = extend_selected_main_duration(
                input,
                &mut selected,
                &mut pillar_seconds,
                min_main_seconds,
                total_seconds,
                max_main_seconds,
                &shares,
            ) {
                total_seconds += duration_delta;
                continue;
            }
            return Err(GenerateWeeklyProgramError::InsufficientDuration);
        };
        let duration = main_slot_duration(next);
        selected.push(next.clone());
        used_exercises.insert(next.candidate.exercise_id);
        *pillar_seconds.entry(next.candidate.pillar).or_default() += duration;
        *pillar_slots.entry(next.candidate.pillar).or_default() += 1;
        total_seconds += duration;
    }

    selected.sort_by_key(|entry| {
        (
            pillar_order(entry.candidate.pillar),
            entry.candidate.session_template_id,
        )
    });
    Ok(selected)
}

/// When eligibility restrictions leave one safe exercise per pillar, preserve
/// variety and reach the duration requested by the user by increasing an
/// existing prescription. Reusing the same exercise as another block would
/// be less useful and can hide catalogue-coverage gaps.
fn extend_selected_main_duration(
    input: &WeeklyProgramAiInput,
    selected: &mut [SelectedMain<'_>],
    pillar_seconds: &mut HashMap<Pillar, u32>,
    min_main_seconds: u32,
    total_seconds: u32,
    max_main_seconds: u32,
    shares: &HashMap<Pillar, f32>,
) -> Option<u32> {
    let mut pillars = Pillar::ALL;
    pillars.sort_by(|left, right| {
        let deficit = |pillar: Pillar| {
            shares[&pillar] * min_main_seconds as f32
                - *pillar_seconds.get(&pillar).unwrap_or(&0) as f32
        };
        deficit(*right).total_cmp(&deficit(*left))
    });

    for pillar in pillars {
        for entry in selected
            .iter_mut()
            .filter(|entry| entry.candidate.pillar == pillar)
        {
            let current_duration = main_slot_duration(entry);
            let Some(next) = longer_prescription(
                &entry.prescription,
                entry.candidate.pillar,
                input.profile.pillar_levels.get(entry.candidate.pillar),
            ) else {
                continue;
            };
            let next_duration = next.estimated_duration_seconds as u32 + MAIN_RECOVERY_SECONDS;
            let Some(delta) = next_duration.checked_sub(current_duration) else {
                continue;
            };
            if total_seconds + delta > max_main_seconds {
                continue;
            }
            entry.prescription = next;
            *pillar_seconds.entry(pillar).or_default() += delta;
            return Some(delta);
        }
    }
    None
}

fn novelty_slot(slot_number: usize, novelty_percent: u8) -> bool {
    let rounded_target = |slots: usize| (slots * novelty_percent as usize + 50) / 100;
    rounded_target(slot_number) > rounded_target(slot_number.saturating_sub(1))
}

fn pick_main_slot<'s, 'a>(
    eligible: &'s [SelectedMain<'a>],
    pillar: Pillar,
    used_exercises: &HashSet<u32>,
    total_seconds: u32,
    max_main_seconds: u32,
    prefer_novelty: bool,
) -> Option<&'s SelectedMain<'a>> {
    let available = |entry: &&SelectedMain<'a>| {
        entry.candidate.pillar == pillar
            && !used_exercises.contains(&entry.candidate.exercise_id)
            && total_seconds + main_slot_duration(entry) <= max_main_seconds
    };
    let has_complete_sheet = eligible
        .iter()
        .filter(available)
        .any(|entry| entry.candidate.complete_exercise_sheet);
    let prioritized_available = |entry: &&SelectedMain<'a>| {
        available(entry) && (!has_complete_sheet || entry.candidate.complete_exercise_sheet)
    };
    if prefer_novelty {
        eligible
            .iter()
            .filter(prioritized_available)
            .find(|entry| entry.appreciation_average.is_none())
            .or_else(|| {
                eligible
                    .iter()
                    .filter(prioritized_available)
                    .min_by(|left, right| {
                        recency_key(left)
                            .cmp(&recency_key(right))
                            .then_with(|| right.score.total_cmp(&left.score))
                            .then_with(|| compare_candidate_stable(left.candidate, right.candidate))
                    })
            })
    } else {
        eligible
            .iter()
            .filter(prioritized_available)
            .filter(|entry| entry.appreciation_average.is_some())
            .max_by(|left, right| {
                left.appreciation_average
                    .unwrap_or(0.0)
                    .total_cmp(&right.appreciation_average.unwrap_or(0.0))
                    .then_with(|| left.score.total_cmp(&right.score))
                    .then_with(|| compare_candidate_stable(right.candidate, left.candidate))
            })
            .or_else(|| eligible.iter().filter(prioritized_available).next())
    }
}

fn compare_complete_sheet_first(left: &CatalogCandidate, right: &CatalogCandidate) -> Ordering {
    right
        .complete_exercise_sheet
        .cmp(&left.complete_exercise_sheet)
}

fn compare_candidate_stable(left: &CatalogCandidate, right: &CatalogCandidate) -> Ordering {
    (
        left.session_template_id,
        left.exercise_id,
        left.format_id,
        left.level,
    )
        .cmp(&(
            right.session_template_id,
            right.exercise_id,
            right.format_id,
            right.level,
        ))
}

fn recency_key(entry: &SelectedMain<'_>) -> (i32, u8, u32) {
    let (year, week) = entry.last_practiced.unwrap_or((i32::MIN, 0));
    (year, week, entry.candidate.session_template_id)
}

fn maximum_history_is_available(
    input: &WeeklyProgramAiInput,
    history: Option<&crate::ExerciseHistory>,
) -> bool {
    let Some(history) = history else {
        return true;
    };
    if !history.reached_maximum || history.appreciation_average.unwrap_or(0.0) < 4.0 {
        return true;
    }
    let Some((last_year, last_week)) = history.last_iso_week_year.zip(history.last_iso_week_number)
    else {
        return false;
    };
    iso_week_distance(
        last_year,
        last_week,
        input.iso_week_year,
        input.iso_week_number,
    ) >= 2
}

fn iso_week_distance(from_year: i32, from_week: u8, to_year: i32, to_week: u8) -> i32 {
    if to_year < from_year || (to_year == from_year && to_week < from_week) {
        return -1;
    }
    if to_year == from_year {
        return i32::from(to_week) - i32::from(from_week);
    }
    let mut distance = iso_weeks_in_year(from_year) - i32::from(from_week) + i32::from(to_week);
    for year in (from_year + 1)..to_year {
        distance += iso_weeks_in_year(year);
    }
    distance
}

fn iso_weeks_in_year(year: i32) -> i32 {
    let january_first = gregorian_weekday(year, 1, 1);
    if january_first == 4 || (january_first == 3 && is_leap_year(year)) {
        53
    } else {
        52
    }
}

fn gregorian_weekday(year: i32, month: i32, day: i32) -> i32 {
    let offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let adjusted_year = if month < 3 { year - 1 } else { year };
    (adjusted_year + adjusted_year / 4 - adjusted_year / 100
        + adjusted_year / 400
        + offsets[(month - 1) as usize]
        + day)
        % 7
}

fn is_leap_year(year: i32) -> bool {
    year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
}

fn build_daily_seances(
    input: &WeeklyProgramAiInput,
    warmup: &CatalogCandidate,
    cooldown: &CatalogCandidate,
    main: &[SelectedMain<'_>],
    training_index: usize,
) -> Vec<crate::Seance> {
    let mut seances = vec![crate::Seance {
        code: "seance-echauffement".into(),
        phase: SessionPhase::Warmup,
        pillar: None,
        title: "Échauffement - 5 min".into(),
        sessions: vec![build_session(
            input,
            warmup,
            fixed_prescription(FIXED_PHASE_SECONDS),
            0,
            training_index,
        )],
    }];
    seances.extend(Pillar::ALL.into_iter().map(|pillar| {
        crate::Seance {
            code: format!("seance-{}", pillar_code(pillar)),
            phase: SessionPhase::Main,
            pillar: Some(pillar),
            title: seance_title(pillar).into(),
            sessions: main
                .iter()
                .filter(|entry| entry.candidate.pillar == pillar)
                .enumerate()
                .map(|(index, entry)| {
                    build_session(
                        input,
                        entry.candidate,
                        entry.prescription.clone(),
                        index,
                        training_index,
                    )
                })
                .collect(),
        }
    }));
    seances.push(crate::Seance {
        code: "seance-assouplissements".into(),
        phase: SessionPhase::Cooldown,
        pillar: None,
        title: "Assouplissements - 5 min".into(),
        sessions: vec![build_session(
            input,
            cooldown,
            fixed_prescription(FIXED_PHASE_SECONDS),
            0,
            training_index,
        )],
    });
    seances
}

fn build_session(
    input: &WeeklyProgramAiInput,
    candidate: &CatalogCandidate,
    prescription: SessionPrescription,
    index: usize,
    training_index: usize,
) -> Session {
    let current_level = input.profile.pillar_levels.get(candidate.pillar);
    let progression_blocked = progression_blocked(input, candidate);
    let easier = candidate
        .regression
        .as_ref()
        .map(|alternative| SessionAlternative {
            name: alternative.exercise_name.clone(),
            level: alternative.level.clamp(1, 10),
            note: "Alternative plus facile validée par le catalogue.".into(),
        })
        .unwrap_or_else(|| SessionAlternative {
            name: candidate.exercise_name.clone(),
            level: candidate.level.min(current_level).clamp(1, 10),
            note: "Réduire la prescription tout en conservant une technique stable.".into(),
        });
    let harder = if candidate.phase != SessionPhase::Main {
        SessionAlternative {
            name: candidate.exercise_name.clone(),
            level: candidate.level,
            note: "Ce bloc fixe n'est pas adaptatif.".into(),
        }
    } else if progression_blocked {
        SessionAlternative {
            name: candidate.exercise_name.clone(),
            level: candidate.level,
            note: "Progression neutralisée à cause de la douleur, de la fatigue ou de la qualité."
                .into(),
        }
    } else {
        candidate
            .progression
            .as_ref()
            .map(|alternative| SessionAlternative {
                name: alternative.exercise_name.clone(),
                level: alternative.level.clamp(1, 10),
                note: "Alternative plus difficile validée par le catalogue.".into(),
            })
            .unwrap_or_else(|| SessionAlternative {
                name: candidate.exercise_name.clone(),
                level: candidate.level,
                note: "Augmenter la prescription uniquement si la technique reste stable.".into(),
            })
    };

    Session {
        code: format!(
            "T{}-{}-{}-{}",
            training_index + 1,
            candidate.exercise_code,
            candidate.format_code,
            index + 1
        ),
        session_template_id: candidate.session_template_id,
        exercise_id: candidate.exercise_id,
        exercise_code: candidate.exercise_code.clone(),
        exercise_name: candidate.exercise_name.clone(),
        format_id: candidate.format_id,
        format_label: candidate.format_label.clone(),
        format_code: candidate.format_code.clone(),
        phase: candidate.phase,
        level: candidate.level,
        prescription,
        easier,
        harder,
        safety_rule: safety_rule(candidate.phase, candidate.pillar).into(),
    }
}

fn progression_for(
    input: &WeeklyProgramAiInput,
    candidate: &CatalogCandidate,
) -> SessionPrescription {
    input
        .exercise_progressions
        .iter()
        .find(|entry| entry.exercise_id == candidate.exercise_id)
        .map(|entry| entry.prescription.clone())
        .unwrap_or_else(|| {
            initial_prescription(
                candidate.prescription_kind,
                candidate.pillar,
                input.profile.pillar_levels.get(candidate.pillar),
            )
        })
}

fn validate_input(input: &WeeklyProgramAiInput) -> Result<(), GenerateWeeklyProgramError> {
    if input.schema_version != 3 {
        return Err(GenerateWeeklyProgramError::InvalidSchemaVersion);
    }
    if !input.profile.level_test_completed || input.profile.level_test_version < 3 {
        return Err(GenerateWeeklyProgramError::LevelTestRequired);
    }
    if !(1..=53).contains(&input.iso_week_number) {
        return Err(GenerateWeeklyProgramError::InvalidIsoWeek);
    }
    if !(1970..=9999).contains(&input.iso_week_year) {
        return Err(GenerateWeeklyProgramError::InvalidIsoWeekYear);
    }
    if input.catalog_version.trim().is_empty() {
        return Err(GenerateWeeklyProgramError::InvalidCatalogVersion);
    }
    if !(1..=7).contains(&input.profile.weekly_frequency) {
        return Err(GenerateWeeklyProgramError::InvalidWeeklyFrequency);
    }
    if input.profile.session_minutes_min < 20
        || input.profile.session_minutes_max > 180
        || input.profile.session_minutes_max < input.profile.session_minutes_min + 5
        || input.profile.session_minutes_min % 5 != 0
        || input.profile.session_minutes_max % 5 != 0
    {
        return Err(GenerateWeeklyProgramError::InvalidTargetDuration);
    }
    if input.profile.weekly_novelty_percent > 100 || input.profile.weekly_novelty_percent % 10 != 0
    {
        return Err(GenerateWeeklyProgramError::InvalidNoveltyPercent);
    }
    if input.profile.id.trim().is_empty()
        || (input.profile.equipment_mode == EquipmentMode::Aucun
            && !input.profile.available_equipment.is_empty())
        || invalid_string_list(&input.profile.available_equipment)
        || invalid_string_list(&input.profile.excluded_exercise_codes)
    {
        return Err(GenerateWeeklyProgramError::InvalidProfile);
    }
    if input.profile.preferred_weekdays.len() != input.profile.weekly_frequency as usize
        || input
            .profile
            .preferred_weekdays
            .iter()
            .any(|weekday| !(1..=7).contains(weekday))
        || input
            .profile
            .preferred_weekdays
            .iter()
            .copied()
            .collect::<HashSet<_>>()
            .len()
            != input.profile.preferred_weekdays.len()
    {
        return Err(GenerateWeeklyProgramError::InvalidPreferredWeekday);
    }
    if [
        input.profile.pillar_levels.strength,
        input.profile.pillar_levels.cardio,
        input.profile.pillar_levels.proprioception,
    ]
    .into_iter()
    .any(|level| !(1..=10).contains(&level))
    {
        return Err(GenerateWeeklyProgramError::InvalidProfileLevel);
    }
    if !stats_valid(&input.recent_stats)
        || input.candidate_recent_stats.iter().any(|entry| {
            entry.session_template_id == 0
                || entry.exercise_id == 0
                || entry.format_id == 0
                || !stats_valid(&entry.stats)
        })
    {
        return Err(GenerateWeeklyProgramError::InvalidRecentStats);
    }
    if input.candidates.is_empty()
        || input.candidates.iter().any(invalid_candidate)
        || input
            .candidates
            .iter()
            .map(|entry| {
                (
                    entry.session_template_id,
                    entry.exercise_id,
                    entry.format_id,
                    entry.level,
                )
            })
            .collect::<HashSet<_>>()
            .len()
            != input.candidates.len()
    {
        return Err(GenerateWeeklyProgramError::InvalidCandidate);
    }
    if input.profile.restrictions.iter().any(invalid_restriction) {
        return Err(GenerateWeeklyProgramError::InvalidRestriction);
    }
    if input
        .exercise_progressions
        .iter()
        .any(|entry| entry.exercise_id == 0 || !valid_prescription(&entry.prescription))
        || input
            .exercise_progressions
            .iter()
            .map(|entry| entry.exercise_id)
            .collect::<HashSet<_>>()
            .len()
            != input.exercise_progressions.len()
        || input.exercise_histories.iter().any(|entry| {
            entry.exercise_id == 0
                || entry
                    .appreciation_average
                    .is_some_and(|value| !value.is_finite() || !(1.0..=5.0).contains(&value))
                || entry
                    .last_iso_week_number
                    .is_some_and(|value| !(1..=53).contains(&value))
                || entry
                    .last_iso_week_year
                    .is_some_and(|value| !(1970..=9999).contains(&value))
                || entry.last_iso_week_year.is_some() != entry.last_iso_week_number.is_some()
        })
        || input
            .exercise_histories
            .iter()
            .map(|entry| entry.exercise_id)
            .collect::<HashSet<_>>()
            .len()
            != input.exercise_histories.len()
    {
        return Err(GenerateWeeklyProgramError::InvalidExerciseState);
    }
    Ok(())
}

fn invalid_candidate(candidate: &CatalogCandidate) -> bool {
    candidate.session_template_id == 0
        || candidate.exercise_id == 0
        || candidate.format_id == 0
        || !(1..=10).contains(&candidate.level)
        || candidate.duration_seconds == 0
        || (candidate.phase == SessionPhase::Main
            && candidate.prescription_kind == PrescriptionKind::Fixed)
        || (candidate.phase != SessionPhase::Main
            && candidate.prescription_kind != PrescriptionKind::Fixed)
        || candidate.exercise_code.trim().is_empty()
        || candidate.format_code.trim().is_empty()
        || candidate.equipment_options.is_empty()
        || candidate.muscle_group_codes.is_empty()
        || invalid_string_list(&candidate.muscle_group_codes)
        || candidate
            .muscle_group_codes
            .iter()
            .any(|code| !valid_muscle_group(code))
        || !equipment_options_valid(&candidate.equipment_options)
        || impact_rank(&candidate.impact_code) == u8::MAX
        || candidate
            .regression
            .as_ref()
            .is_some_and(invalid_alternative)
        || candidate
            .progression
            .as_ref()
            .is_some_and(invalid_alternative)
        || (candidate.phase != SessionPhase::Main
            && candidate.prescription_kind != PrescriptionKind::Fixed)
}

fn valid_prescription(value: &SessionPrescription) -> bool {
    if value.series == 0 || value.estimated_duration_seconds == 0 {
        return false;
    }
    match value.kind {
        PrescriptionKind::Repetitions => {
            value.adaptable
                && value
                    .repetitions
                    .is_some_and(|reps| (4..=12).contains(&reps))
                && (2..=12).contains(&value.series)
        }
        PrescriptionKind::Intervals => {
            value.adaptable
                && value.repetitions.is_none()
                && value
                    .effort_seconds
                    .is_some_and(|seconds| (10..=300).contains(&seconds))
                && (10..=300).contains(&value.rest_seconds)
                && (1..=8).contains(&value.series)
        }
        PrescriptionKind::Fixed => {
            !value.adaptable
                && value.series == 1
                && value.repetitions.is_none()
                && value.rest_seconds == 0
        }
    }
}

fn invalid_restriction(restriction: &StructuredRestriction) -> bool {
    match restriction {
        StructuredRestriction::ImpactLimit { maximum_impact } => {
            impact_rank(maximum_impact) == u8::MAX
        }
        StructuredRestriction::ExerciseExclusion { exercise_code } => {
            exercise_code.trim().is_empty()
        }
        StructuredRestriction::PillarLimit { maximum_level, .. } => {
            !(1..=10).contains(maximum_level)
        }
        StructuredRestriction::EquipmentExclusion { equipment_code } => {
            equipment_code.trim().is_empty()
        }
        StructuredRestriction::TemporaryPain { muscle_group_codes } => {
            muscle_group_codes.is_empty()
                || invalid_string_list(muscle_group_codes)
                || muscle_group_codes
                    .iter()
                    .any(|code| !valid_muscle_group(code))
        }
    }
}

fn invalid_string_list(values: &[String]) -> bool {
    values.iter().any(|value| value.trim().is_empty())
        || values.iter().collect::<HashSet<_>>().len() != values.len()
}

fn stats_valid(stats: &crate::RecentStats) -> bool {
    [stats.success_rate, stats.fatigue, stats.pain_rate]
        .into_iter()
        .all(|value| value.is_finite() && (0.0..=1.0).contains(&value))
}

fn invalid_alternative(value: &crate::CandidateAlternative) -> bool {
    value.exercise_name.trim().is_empty() || !(1..=10).contains(&value.level)
}

fn valid_muscle_group(value: &str) -> bool {
    matches!(
        value,
        "bras" | "epaules" | "dos" | "jambes" | "fessiers" | "abdos" | "pecs"
    )
}

fn equipment_options_valid(options: &[EquipmentOption]) -> bool {
    options
        .iter()
        .filter(|option| matches!(option, EquipmentOption::Bodyweight))
        .count()
        <= 1
        && options.iter().all(|option| match option {
            EquipmentOption::Bodyweight => true,
            EquipmentOption::Equipment { equipment_codes } => {
                !equipment_codes.is_empty() && !invalid_string_list(equipment_codes)
            }
        })
}

fn candidate_allowed(
    input: &WeeklyProgramAiInput,
    candidate: &CatalogCandidate,
    block_progression: bool,
) -> bool {
    let user_level = input.profile.pillar_levels.get(candidate.pillar);
    let level_delta = candidate.level as i16 - user_level as i16;
    (level_delta.abs() <= 1 || low_impact_regression_fallback(input, candidate))
        && (!block_progression || level_delta <= 0)
        && !input
            .profile
            .excluded_exercise_codes
            .contains(&candidate.exercise_code)
        && candidate_has_available_option(input, candidate)
        && input
            .profile
            .restrictions
            .iter()
            .all(|restriction| match restriction {
                StructuredRestriction::ImpactLimit { maximum_impact } => {
                    impact_rank(&candidate.impact_code) <= impact_rank(maximum_impact)
                }
                StructuredRestriction::ExerciseExclusion { exercise_code } => {
                    exercise_code != &candidate.exercise_code
                }
                StructuredRestriction::PillarLimit {
                    pillar,
                    maximum_level,
                } => candidate.pillar != *pillar || candidate.level <= *maximum_level,
                StructuredRestriction::EquipmentExclusion { equipment_code } => candidate
                    .equipment_options
                    .iter()
                    .any(|option| match option {
                        EquipmentOption::Bodyweight => true,
                        EquipmentOption::Equipment { equipment_codes } => {
                            !equipment_codes.contains(equipment_code)
                                && equipment_codes.iter().all(|required| {
                                    input.profile.available_equipment.contains(required)
                                })
                        }
                    }),
                StructuredRestriction::TemporaryPain { muscle_group_codes } => !candidate
                    .muscle_group_codes
                    .iter()
                    .any(|group| muscle_group_codes.contains(group)),
            })
}

fn low_impact_regression_fallback(
    input: &WeeklyProgramAiInput,
    candidate: &CatalogCandidate,
) -> bool {
    input.profile.low_impact()
        && (candidate.level as i16) < input.profile.pillar_levels.get(candidate.pillar) as i16 - 1
}

fn fixed_candidate_allowed(input: &WeeklyProgramAiInput, candidate: &CatalogCandidate) -> bool {
    !input
        .profile
        .excluded_exercise_codes
        .contains(&candidate.exercise_code)
        && candidate_has_available_option(input, candidate)
        && input
            .profile
            .restrictions
            .iter()
            .all(|restriction| match restriction {
                StructuredRestriction::ImpactLimit { maximum_impact } => {
                    impact_rank(&candidate.impact_code) <= impact_rank(maximum_impact)
                }
                StructuredRestriction::ExerciseExclusion { exercise_code } => {
                    exercise_code != &candidate.exercise_code
                }
                StructuredRestriction::PillarLimit { .. } => true,
                StructuredRestriction::EquipmentExclusion { equipment_code } => candidate
                    .equipment_options
                    .iter()
                    .any(|option| match option {
                        EquipmentOption::Bodyweight => true,
                        EquipmentOption::Equipment { equipment_codes } => {
                            !equipment_codes.contains(equipment_code)
                                && equipment_codes.iter().all(|required| {
                                    input.profile.available_equipment.contains(required)
                                })
                        }
                    }),
                StructuredRestriction::TemporaryPain { muscle_group_codes } => !candidate
                    .muscle_group_codes
                    .iter()
                    .any(|group| muscle_group_codes.contains(group)),
            })
}

fn candidate_has_available_option(
    input: &WeeklyProgramAiInput,
    candidate: &CatalogCandidate,
) -> bool {
    candidate
        .equipment_options
        .iter()
        .any(|option| match option {
            EquipmentOption::Bodyweight => true,
            EquipmentOption::Equipment { equipment_codes } => {
                input.profile.equipment_mode == EquipmentMode::Mixte
                    && equipment_codes
                        .iter()
                        .all(|required| input.profile.available_equipment.contains(required))
            }
        })
}

fn stats_for_candidate<'a>(
    input: &'a WeeklyProgramAiInput,
    candidate: &CatalogCandidate,
) -> &'a crate::RecentStats {
    input
        .candidate_recent_stats
        .iter()
        .find(|entry| {
            entry.session_template_id == candidate.session_template_id
                && entry.exercise_id == candidate.exercise_id
                && entry.format_id == candidate.format_id
        })
        .map(|entry| &entry.stats)
        .unwrap_or(&input.recent_stats)
}

fn progression_blocked(input: &WeeklyProgramAiInput, candidate: &CatalogCandidate) -> bool {
    let stats = stats_for_candidate(input, candidate);
    stats.fatigue >= 0.7 || stats.pain_rate > 0.0 || input.profile.restrictions.iter().any(|restriction| matches!(restriction, StructuredRestriction::TemporaryPain { muscle_group_codes } if candidate.muscle_group_codes.iter().any(|group| muscle_group_codes.contains(group))))
}

fn objective_bonus(objective: ObjectiveCode, pillar: Pillar) -> f32 {
    focused_pillar(objective).map_or(0.0, |focused| if pillar == focused { 0.18 } else { -0.03 })
}

fn focused_pillar(objective: ObjectiveCode) -> Option<Pillar> {
    match objective {
        ObjectiveCode::Complete => None,
        ObjectiveCode::Strength => Some(Pillar::Strength),
        ObjectiveCode::Cardio => Some(Pillar::Cardio),
        ObjectiveCode::Proprioception => Some(Pillar::Proprioception),
    }
}

fn objective_shares(objective: ObjectiveCode) -> HashMap<Pillar, f32> {
    Pillar::ALL
        .into_iter()
        .map(|pillar| {
            let share = focused_pillar(objective).map_or(1.0 / 3.0, |focused| {
                if pillar == focused { 0.5 } else { 0.25 }
            });
            (pillar, share)
        })
        .collect()
}

fn preferred_day(preferred_weekdays: &[u8], index: usize) -> &'static str {
    match preferred_weekdays
        .get(index)
        .copied()
        .unwrap_or((index + 1) as u8)
    {
        1 => "Lundi",
        2 => "Mardi",
        3 => "Mercredi",
        4 => "Jeudi",
        5 => "Vendredi",
        6 => "Samedi",
        _ => "Dimanche",
    }
}

fn pillar_order(pillar: Pillar) -> u8 {
    match pillar {
        Pillar::Strength => 0,
        Pillar::Cardio => 1,
        Pillar::Proprioception => 2,
    }
}

fn pillar_code(pillar: Pillar) -> &'static str {
    match pillar {
        Pillar::Strength => "strength",
        Pillar::Cardio => "cardio",
        Pillar::Proprioception => "proprioception",
    }
}

fn seance_title(pillar: Pillar) -> &'static str {
    match pillar {
        Pillar::Strength => "Renforcement",
        Pillar::Cardio => "Cardio",
        Pillar::Proprioception => "Proprioception",
    }
}

fn safety_rule(phase: SessionPhase, pillar: Pillar) -> &'static str {
    match phase {
        SessionPhase::Warmup => {
            "Préparer progressivement les articulations sans rechercher la fatigue."
        }
        SessionPhase::Cooldown => {
            "Rester sous le seuil douloureux et respirer sans forcer l'amplitude."
        }
        SessionPhase::Main => match pillar {
            Pillar::Strength => {
                "Arrêter avant toute perte de forme et conserver les repos prescrits."
            }
            Pillar::Cardio => {
                "Réduire l'intensité dès que la posture ou la respiration se dégrade."
            }
            Pillar::Proprioception => {
                "Réduire la variante dès que la ligne corporelle ou les appuis se défont."
            }
        },
    }
}

fn impact_rank(impact: &str) -> u8 {
    match impact {
        "faible" => 0,
        "modere" => 1,
        "eleve" => 2,
        _ => u8::MAX,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        CandidateAlternative, EquipmentOption, ExerciseHistory, PillarLevels, RecentStats,
        UserProfile,
    };

    #[test]
    fn blocks_generation_until_level_evaluation_v3_is_complete() {
        let mut input = test_input();
        input.profile.level_test_completed = false;
        assert_eq!(
            generate_weekly_program(&input).unwrap_err(),
            GenerateWeeklyProgramError::LevelTestRequired
        );

        input.profile.level_test_completed = true;
        input.profile.level_test_version = 1;
        assert_eq!(
            generate_weekly_program(&input).unwrap_err(),
            GenerateWeeklyProgramError::LevelTestRequired
        );
    }

    #[test]
    fn generates_one_stable_five_phase_composition_for_every_day() {
        let input = test_input();
        let program = generate_weekly_program(&input).unwrap();
        assert_eq!(program.schema_version, 3);
        assert_eq!(program.trainings.len(), 2);
        assert!(
            program
                .trainings
                .iter()
                .all(|training| training.seances.len() == 5)
        );
        assert!(
            program
                .trainings
                .iter()
                .all(|training| (20..=45).contains(&training.duration_minutes))
        );
        let first = main_exercise_ids(&program.trainings[0]);
        assert_eq!(first, main_exercise_ids(&program.trainings[1]));
        assert!(Pillar::ALL.into_iter().all(|pillar| {
            program.trainings[0]
                .seances
                .iter()
                .any(|seance| seance.pillar == Some(pillar) && !seance.sessions.is_empty())
        }));
        assert!(
            program.trainings[0]
                .seances
                .first()
                .unwrap()
                .sessions
                .iter()
                .all(|session| !session.prescription.adaptable)
        );
        assert!(
            program.trainings[0]
                .seances
                .last()
                .unwrap()
                .sessions
                .iter()
                .all(|session| !session.prescription.adaptable)
        );
    }

    #[test]
    fn rejects_invalid_schema_and_duration_ranges() {
        let mut input = test_input();
        input.schema_version = 2;
        assert_eq!(
            generate_weekly_program(&input).unwrap_err(),
            GenerateWeeklyProgramError::InvalidSchemaVersion
        );
        input.schema_version = 3;
        input.profile.session_minutes_max = input.profile.session_minutes_min;
        assert_eq!(
            generate_weekly_program(&input).unwrap_err(),
            GenerateWeeklyProgramError::InvalidTargetDuration
        );
    }

    #[test]
    fn fixed_phases_are_not_filtered_by_the_test_level() {
        let mut input = test_input();
        input.profile.pillar_levels = PillarLevels {
            strength: 3,
            cardio: 3,
            proprioception: 3,
        };

        let program = generate_weekly_program(&input).unwrap();
        assert_eq!(program.trainings[0].seances[0].phase, SessionPhase::Warmup);
        assert_eq!(
            program.trainings[0].seances[4].phase,
            SessionPhase::Cooldown
        );
    }

    #[test]
    fn low_impact_profiles_can_safely_regress_when_no_near_level_main_candidate_exists() {
        let mut input = test_input();
        input.profile.pillar_levels = PillarLevels {
            strength: 10,
            cardio: 10,
            proprioception: 10,
        };
        input.profile.restrictions = vec![StructuredRestriction::ImpactLimit {
            maximum_impact: "faible".into(),
        }];

        let program = generate_weekly_program(&input).unwrap();

        assert_eq!(main_exercise_ids(&program.trainings[0]).len(), 3);
    }

    #[test]
    fn low_impact_profiles_extend_safe_prescriptions_before_reusing_exercises() {
        let mut input = test_input();
        input.profile.weekly_frequency = 1;
        input.profile.preferred_weekdays = vec![2];
        input.profile.session_minutes_min = 30;
        input.profile.session_minutes_max = 45;
        input.profile.restrictions = vec![StructuredRestriction::ImpactLimit {
            maximum_impact: "faible".into(),
        }];
        input.candidates.retain(|candidate| {
            candidate.phase != SessionPhase::Main || [1, 101, 201].contains(&candidate.exercise_id)
        });

        let program = generate_weekly_program(&input).unwrap();
        let training = &program.trainings[0];

        assert!((30..=45).contains(&training.duration_minutes));
        assert_eq!(main_exercise_ids(training), vec![1, 101, 201]);
    }

    #[test]
    fn fixed_phases_prefer_complete_sheets_and_keep_an_incomplete_fallback() {
        let mut input = test_input();
        let mut incomplete = candidate(
            899,
            Pillar::Proprioception,
            SessionPhase::Warmup,
            PrescriptionKind::Fixed,
            1,
        );
        incomplete.complete_exercise_sheet = false;
        input.candidates.push(incomplete);

        let prioritized = generate_weekly_program(&input).unwrap();
        assert_eq!(
            prioritized.trainings[0].seances[0].sessions[0].exercise_id,
            900
        );

        input
            .candidates
            .iter_mut()
            .find(|candidate| candidate.exercise_id == 900)
            .unwrap()
            .complete_exercise_sheet = false;
        let fallback = generate_weekly_program(&input).unwrap();
        assert_eq!(
            fallback.trainings[0].seances[0].sessions[0].exercise_id,
            899
        );
    }

    #[test]
    fn novelty_zero_prefers_the_best_appreciated_exercise_per_pillar() {
        let mut input = test_input();
        input.profile.weekly_novelty_percent = 0;
        input.exercise_histories = main_histories(&input, false);

        let program = generate_weekly_program(&input).unwrap();
        let selected = main_exercise_ids(&program.trainings[0]);
        assert!([8, 108, 208].into_iter().all(|id| selected.contains(&id)));
    }

    #[test]
    fn novelty_hundred_prefers_never_appreciated_exercises() {
        let mut input = test_input();
        input.profile.weekly_novelty_percent = 100;
        input.exercise_histories = main_histories(&input, true);

        let program = generate_weekly_program(&input).unwrap();
        let selected = main_exercise_ids(&program.trainings[0]);
        assert!([8, 108, 208].into_iter().all(|id| selected.contains(&id)));
    }

    #[test]
    fn complete_exercise_sheets_take_priority_over_higher_appreciation() {
        let mut input = test_input();
        input.profile.weekly_novelty_percent = 0;
        input.exercise_histories = main_histories(&input, false);
        for candidate in input
            .candidates
            .iter_mut()
            .filter(|candidate| candidate.phase == SessionPhase::Main)
        {
            candidate.complete_exercise_sheet = candidate.exercise_id % 100 == 1;
        }

        let program = generate_weekly_program(&input).unwrap();
        let selected = main_exercise_ids(&program.trainings[0]);
        assert!([1, 101, 201].into_iter().all(|id| selected.contains(&id)));
    }

    #[test]
    fn incomplete_sheet_fallback_is_stable_when_no_complete_sheet_is_available() {
        let mut input = test_input();
        input.profile.weekly_novelty_percent = 0;
        input.exercise_histories = main_histories(&input, false);
        for candidate in &mut input.candidates {
            candidate.complete_exercise_sheet = false;
        }

        let first = generate_weekly_program(&input).unwrap();
        input.candidates.reverse();
        let reversed = generate_weekly_program(&input).unwrap();

        assert_eq!(
            main_exercise_ids(&first.trainings[0]),
            main_exercise_ids(&reversed.trainings[0])
        );
        let selected = main_exercise_ids(&first.trainings[0]);
        assert!([8, 108, 208].into_iter().all(|id| selected.contains(&id)));
    }

    #[test]
    fn a_highly_appreciated_maximum_returns_only_after_one_absent_week() {
        let mut input = test_input();
        input.profile.weekly_novelty_percent = 0;
        input.exercise_histories = main_histories(&input, false)
            .into_iter()
            .map(|mut history| {
                if history.exercise_id % 100 == 8 {
                    history.reached_maximum = true;
                    history.last_iso_week_number = Some(28);
                }
                history
            })
            .collect();

        input.iso_week_number = 29;
        let immediate = generate_weekly_program(&input).unwrap();
        let immediate_ids = main_exercise_ids(&immediate.trainings[0]);
        assert!(
            [8, 108, 208]
                .into_iter()
                .all(|id| !immediate_ids.contains(&id))
        );

        input.iso_week_number = 30;
        let after_absence = generate_weekly_program(&input).unwrap();
        let after_absence_ids = main_exercise_ids(&after_absence.trainings[0]);
        assert!(
            [8, 108, 208]
                .into_iter()
                .all(|id| after_absence_ids.contains(&id))
        );
    }

    fn main_exercise_ids(training: &Training) -> Vec<u32> {
        training
            .seances
            .iter()
            .filter(|seance| seance.phase == SessionPhase::Main)
            .flat_map(|seance| seance.sessions.iter().map(|session| session.exercise_id))
            .collect()
    }

    fn main_histories(
        input: &WeeklyProgramAiInput,
        leave_best_unseen: bool,
    ) -> Vec<ExerciseHistory> {
        input
            .candidates
            .iter()
            .filter(|candidate| candidate.phase == SessionPhase::Main)
            .filter_map(|candidate| {
                let best = candidate.exercise_id % 100 == 8;
                if leave_best_unseen && best {
                    return None;
                }
                Some(ExerciseHistory {
                    exercise_id: candidate.exercise_id,
                    appreciation_average: Some(if best { 5.0 } else { 2.0 }),
                    last_iso_week_year: Some(2026),
                    last_iso_week_number: Some(if best { 20 } else { 28 }),
                    reached_maximum: false,
                })
            })
            .collect()
    }

    fn test_input() -> WeeklyProgramAiInput {
        let mut candidates = Vec::new();
        candidates.push(candidate(
            900,
            Pillar::Proprioception,
            SessionPhase::Warmup,
            PrescriptionKind::Fixed,
            1,
        ));
        candidates.push(candidate(
            901,
            Pillar::Proprioception,
            SessionPhase::Cooldown,
            PrescriptionKind::Fixed,
            1,
        ));
        for pillar in Pillar::ALL {
            for offset in 1..=8 {
                candidates.push(candidate(
                    pillar_order(pillar) as u32 * 100 + offset,
                    pillar,
                    SessionPhase::Main,
                    if pillar == Pillar::Cardio {
                        PrescriptionKind::Intervals
                    } else {
                        PrescriptionKind::Repetitions
                    },
                    2,
                ));
            }
        }
        WeeklyProgramAiInput {
            schema_version: 3,
            profile: UserProfile {
                id: "profile-1".into(),
                objective_code: ObjectiveCode::Complete,
                equipment_mode: EquipmentMode::Aucun,
                weekly_frequency: 2,
                session_minutes_min: 20,
                session_minutes_max: 45,
                weekly_novelty_percent: 50,
                level_test_completed: true,
                level_test_version: 3,
                pillar_levels: PillarLevels {
                    strength: 2,
                    cardio: 2,
                    proprioception: 2,
                },
                available_equipment: vec![],
                preferred_weekdays: vec![2, 5],
                restrictions: vec![],
                excluded_exercise_codes: vec![],
            },
            candidates,
            recent_stats: RecentStats::default(),
            candidate_recent_stats: vec![],
            exercise_progressions: vec![],
            exercise_histories: vec![],
            iso_week_year: 2026,
            iso_week_number: 29,
            catalog_version: "test-v3".into(),
        }
    }

    fn candidate(
        id: u32,
        pillar: Pillar,
        phase: SessionPhase,
        kind: PrescriptionKind,
        level: u8,
    ) -> CatalogCandidate {
        CatalogCandidate {
            session_template_id: id,
            exercise_id: id,
            exercise_code: format!("exercise-{id}"),
            exercise_name: format!("Exercise {id}"),
            format_id: id,
            format_code: format!("format-{id}"),
            format_label: "Prescription".into(),
            pillar,
            phase,
            prescription_kind: kind,
            level,
            duration_seconds: 300,
            complete_exercise_sheet: true,
            equipment_options: vec![EquipmentOption::Bodyweight],
            muscle_group_codes: vec!["jambes".into()],
            impact_code: "faible".into(),
            regression: Some(CandidateAlternative {
                exercise_name: "Régression".into(),
                level: 1,
            }),
            progression: Some(CandidateAlternative {
                exercise_name: "Progression".into(),
                level: 3,
            }),
        }
    }
}
