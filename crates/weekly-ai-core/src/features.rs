use crate::{CatalogCandidate, EquipmentMode, EquipmentOption, Pillar, RecentStats, UserProfile};

pub const FEATURE_COUNT: usize = 16;

pub fn build_features(
    candidate: &CatalogCandidate,
    profile: &UserProfile,
    stats: &RecentStats,
) -> [f32; FEATURE_COUNT] {
    let user_level = profile.pillar_levels.get(candidate.pillar) as f32;
    let candidate_level = candidate.level as f32;

    [
        profile.pillar_levels.strength as f32 / 10.0,
        profile.pillar_levels.cardio as f32 / 10.0,
        profile.pillar_levels.proprioception as f32 / 10.0,
        (((profile.session_minutes_min + profile.session_minutes_max) as f32 / 2.0) / 180.0)
            .clamp(0.0, 1.0),
        (profile.weekly_frequency as f32 / 7.0).clamp(0.0, 1.0),
        bool_feature(profile.low_impact()),
        bool_feature(equipment_matches(profile, candidate)),
        bool_feature(candidate.pillar == Pillar::Strength),
        bool_feature(candidate.pillar == Pillar::Cardio),
        bool_feature(candidate.pillar == Pillar::Proprioception),
        ((candidate_level - user_level) / 2.0).clamp(-1.0, 1.0),
        stats.success_rate.clamp(0.0, 1.0),
        stats.fatigue.clamp(0.0, 1.0),
        (stats.skipped_sessions as f32 / 5.0).clamp(0.0, 1.0),
        bool_feature(stats.progression_needed),
        bool_feature(stats.regression_needed),
    ]
}

pub fn heuristic_score(features: &[f32; FEATURE_COUNT]) -> f32 {
    let level_delta = features[10];
    let success = features[11];
    let fatigue = features[12];
    let skipped = features[13];
    let progression_needed = features[14];
    let regression_needed = features[15];

    let mut score = 0.72;
    score -= level_delta.abs() * 0.24;
    score += (success - 0.5) * 0.18;
    score -= fatigue * 0.24;
    score -= skipped * 0.12;
    score += progression_needed * level_delta.max(0.0) * 0.18;
    score += regression_needed * (-level_delta).max(0.0) * 0.22;
    score -= (1.0 - features[6]) * 0.7;

    if features[5] > 0.5 && fatigue > 0.7 && level_delta > 0.0 {
        score -= 0.3;
    }

    score.clamp(0.0, 1.0)
}

fn equipment_matches(profile: &UserProfile, candidate: &CatalogCandidate) -> bool {
    candidate
        .equipment_options
        .iter()
        .any(|option| match option {
            EquipmentOption::Bodyweight => true,
            EquipmentOption::Equipment { equipment_codes } => {
                profile.equipment_mode == EquipmentMode::Mixte
                    && equipment_codes.iter().all(|required| {
                        profile
                            .available_equipment
                            .iter()
                            .any(|available| available == required)
                    })
            }
        })
}

fn bool_feature(value: bool) -> f32 {
    if value { 1.0 } else { 0.0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CandidateAlternative, PillarLevels, PrescriptionKind, SessionPhase};

    #[test]
    fn builds_stable_normalized_features() {
        let profile = profile();
        let stats = RecentStats {
            success_rate: 0.8,
            fatigue: 0.25,
            skipped_sessions: 1,
            pain_rate: 0.0,
            progression_needed: true,
            regression_needed: false,
        };
        let candidate = candidate();

        let features = build_features(&candidate, &profile, &stats);

        assert_eq!(features.len(), FEATURE_COUNT);
        assert_eq!(features[6], 1.0);
        assert_eq!(features[7], 1.0);
        assert_eq!(features[10], 0.5);
        assert!(features.iter().all(|value| (-1.0..=1.0).contains(value)));
    }

    fn profile() -> UserProfile {
        UserProfile {
            id: "test".into(),
            objective_code: crate::ObjectiveCode::Complete,
            equipment_mode: EquipmentMode::Mixte,
            weekly_frequency: 3,
            session_minutes_min: 30,
            session_minutes_max: 45,
            weekly_novelty_percent: 50,
            level_test_completed: true,
            level_test_version: 3,
            pillar_levels: PillarLevels {
                strength: 2,
                cardio: 2,
                proprioception: 1,
            },
            available_equipment: vec!["mur".into()],
            preferred_weekdays: vec![1, 3, 5],
            restrictions: vec![crate::StructuredRestriction::ImpactLimit {
                maximum_impact: "faible".into(),
            }],
            excluded_exercise_codes: vec![],
        }
    }

    fn candidate() -> CatalogCandidate {
        CatalogCandidate {
            session_template_id: 1,
            exercise_id: 1,
            exercise_code: "pompe-mur".into(),
            exercise_name: "Pompe murale".into(),
            format_id: 1,
            format_code: "format-1".into(),
            format_label: "3 x 8".into(),
            pillar: Pillar::Strength,
            phase: SessionPhase::Main,
            prescription_kind: PrescriptionKind::Repetitions,
            level: 3,
            duration_seconds: 300,
            complete_exercise_sheet: true,
            equipment_options: vec![EquipmentOption::Equipment {
                equipment_codes: vec!["mur".into()],
            }],
            muscle_group_codes: vec!["pecs".into()],
            impact_code: "faible".into(),
            regression: Some(CandidateAlternative {
                exercise_name: "Pompe très inclinée".into(),
                level: 2,
            }),
            progression: None,
        }
    }
}
