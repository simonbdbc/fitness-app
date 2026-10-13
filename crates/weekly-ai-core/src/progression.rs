use crate::{Pillar, PrescriptionKind, SessionPrescription};

const DEFAULT_REPETITION_SECONDS: u16 = 4;
const DEFAULT_REPETITION_REST_SECONDS: u16 = 30;

pub fn initial_prescription(
    kind: PrescriptionKind,
    pillar: Pillar,
    level: u8,
) -> SessionPrescription {
    match kind {
        PrescriptionKind::Repetitions => repetition_ladder(level)[0].clone(),
        PrescriptionKind::Intervals => interval_ladder(pillar, level)[0].clone(),
        PrescriptionKind::Fixed => fixed_prescription(300),
    }
}

pub fn fixed_prescription(duration_seconds: u16) -> SessionPrescription {
    SessionPrescription {
        kind: PrescriptionKind::Fixed,
        series: 1,
        repetitions: None,
        effort_seconds: Some(duration_seconds),
        rest_seconds: 0,
        estimated_duration_seconds: duration_seconds,
        adaptable: false,
    }
}

pub fn harder_prescription(
    current: &SessionPrescription,
    pillar: Pillar,
    level: u8,
) -> SessionPrescription {
    move_prescription(current, pillar, level, 1)
}

/// Returns the next safe progression whose estimated duration is strictly
/// longer. Ladders may shorten rest before adding work, so the immediately
/// harder step is not necessarily suitable when filling a user-selected
/// session duration.
pub fn longer_prescription(
    current: &SessionPrescription,
    pillar: Pillar,
    level: u8,
) -> Option<SessionPrescription> {
    if !current.adaptable || current.kind == PrescriptionKind::Fixed {
        return None;
    }
    let ladder = ladder_for(current.kind, pillar, level);
    let index = ladder
        .iter()
        .position(|value| value == current)
        .unwrap_or(0);
    ladder
        .into_iter()
        .skip(index + 1)
        .find(|candidate| candidate.estimated_duration_seconds > current.estimated_duration_seconds)
}

pub fn easier_prescription(
    current: &SessionPrescription,
    pillar: Pillar,
    level: u8,
) -> SessionPrescription {
    move_prescription(current, pillar, level, -1)
}

pub fn prescription_at_maximum(
    prescription: &SessionPrescription,
    pillar: Pillar,
    level: u8,
) -> bool {
    if prescription.kind == PrescriptionKind::Fixed {
        return true;
    }
    let ladder = ladder_for(prescription.kind, pillar, level);
    ladder.last() == Some(prescription)
}

fn move_prescription(
    current: &SessionPrescription,
    pillar: Pillar,
    level: u8,
    delta: i32,
) -> SessionPrescription {
    if !current.adaptable || current.kind == PrescriptionKind::Fixed {
        return current.clone();
    }
    let ladder = ladder_for(current.kind, pillar, level);
    let index = ladder
        .iter()
        .position(|value| value == current)
        .unwrap_or(0) as i32;
    ladder[(index + delta).clamp(0, ladder.len() as i32 - 1) as usize].clone()
}

fn ladder_for(kind: PrescriptionKind, pillar: Pillar, level: u8) -> Vec<SessionPrescription> {
    match kind {
        PrescriptionKind::Repetitions => repetition_ladder(level),
        PrescriptionKind::Intervals => interval_ladder(pillar, level),
        PrescriptionKind::Fixed => vec![fixed_prescription(300)],
    }
}

fn repetition_ladder(level: u8) -> Vec<SessionPrescription> {
    let (series_min, series_max, repetitions_min, repetitions_max) = if level.clamp(1, 10) <= 5 {
        (2, 8, 4, 8)
    } else {
        (6, 12, 8, 12)
    };
    let mut values = Vec::new();
    for series in series_min..=series_max {
        for repetitions in repetitions_min..=repetitions_max {
            values.push(repetition_prescription(series, repetitions));
        }
    }
    values
}

fn interval_ladder(pillar: Pillar, level: u8) -> Vec<SessionPrescription> {
    let high_tier = level.clamp(1, 10) >= 6;
    let (series_min, series_max, effort_min, effort_max, effort_step, rests): (
        u8,
        u8,
        u16,
        u16,
        u16,
        Vec<u16>,
    ) = match (pillar, high_tier) {
        (Pillar::Cardio, false) => (2, 5, 30, 60, 10, vec![60, 50, 40, 30]),
        (Pillar::Cardio, true) => (4, 8, 20, 60, 10, vec![60, 50, 40, 30, 20]),
        (_, false) => (1, 4, 30, 180, 30, vec![60, 30]),
        (_, true) => (1, 8, 30, 300, 30, vec![60, 30]),
    };
    let mut values = Vec::new();
    for series in series_min..=series_max {
        for effort in (effort_min..=effort_max).step_by(effort_step as usize) {
            values.push(interval_prescription(series, effort, rests[0]));
        }
        for rest in rests.iter().skip(1) {
            values.push(interval_prescription(series, effort_max, *rest));
        }
    }
    values
}

fn repetition_prescription(series: u8, repetitions: u8) -> SessionPrescription {
    SessionPrescription {
        kind: PrescriptionKind::Repetitions,
        series,
        repetitions: Some(repetitions),
        effort_seconds: None,
        rest_seconds: DEFAULT_REPETITION_REST_SECONDS,
        estimated_duration_seconds: estimate_repetition_duration(series, repetitions),
        adaptable: true,
    }
}

fn interval_prescription(
    series: u8,
    effort_seconds: u16,
    rest_seconds: u16,
) -> SessionPrescription {
    SessionPrescription {
        kind: PrescriptionKind::Intervals,
        series,
        repetitions: None,
        effort_seconds: Some(effort_seconds),
        rest_seconds,
        estimated_duration_seconds: series as u16 * effort_seconds
            + series.saturating_sub(1) as u16 * rest_seconds,
        adaptable: true,
    }
}

fn estimate_repetition_duration(series: u8, repetitions: u8) -> u16 {
    series as u16 * repetitions as u16 * DEFAULT_REPETITION_SECONDS
        + series.saturating_sub(1) as u16 * DEFAULT_REPETITION_REST_SECONDS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repetition_tiers_have_the_required_bounds() {
        let low = repetition_ladder(5);
        assert_eq!((low[0].series, low[0].repetitions), (2, Some(4)));
        assert_eq!(
            (low.last().unwrap().series, low.last().unwrap().repetitions),
            (8, Some(8))
        );
        let high = repetition_ladder(6);
        assert_eq!((high[0].series, high[0].repetitions), (6, Some(8)));
        assert_eq!(
            (
                high.last().unwrap().series,
                high.last().unwrap().repetitions
            ),
            (12, Some(12))
        );
    }

    #[test]
    fn interval_ladders_change_effort_rest_then_series() {
        let effort_max = interval_prescription(2, 60, 60);
        assert_eq!(
            harder_prescription(&effort_max, Pillar::Cardio, 5).rest_seconds,
            50
        );
        let stage_max = interval_prescription(2, 60, 30);
        let next = harder_prescription(&stage_max, Pillar::Cardio, 5);
        assert_eq!(
            (next.series, next.effort_seconds, next.rest_seconds),
            (3, Some(30), 60)
        );
        assert_eq!(easier_prescription(&next, Pillar::Cardio, 5), stage_max);
    }

    #[test]
    fn initial_anchors_follow_pillar_and_tier() {
        assert_eq!(
            initial_prescription(PrescriptionKind::Repetitions, Pillar::Strength, 5).series,
            2
        );
        assert_eq!(
            initial_prescription(PrescriptionKind::Repetitions, Pillar::Strength, 6).series,
            6
        );
        let cardio = initial_prescription(PrescriptionKind::Intervals, Pillar::Cardio, 6);
        assert_eq!(
            (cardio.series, cardio.effort_seconds, cardio.rest_seconds),
            (4, Some(20), 60)
        );
        let proprio = initial_prescription(PrescriptionKind::Intervals, Pillar::Proprioception, 5);
        assert_eq!((proprio.series, proprio.effort_seconds), (1, Some(30)));
    }

    #[test]
    fn longer_prescription_skips_shorter_rest_transitions() {
        let current = interval_prescription(2, 60, 60);

        let longer = longer_prescription(&current, Pillar::Cardio, 2).unwrap();

        assert_eq!(
            (longer.series, longer.effort_seconds, longer.rest_seconds),
            (3, Some(30), 60)
        );
        assert!(longer.estimated_duration_seconds > current.estimated_duration_seconds);
    }

    #[test]
    fn all_six_scales_reach_their_exact_maximum_and_regress() {
        let cases = [
            (
                PrescriptionKind::Repetitions,
                Pillar::Strength,
                5,
                (8, Some(8), None, 30),
            ),
            (
                PrescriptionKind::Repetitions,
                Pillar::Strength,
                6,
                (12, Some(12), None, 30),
            ),
            (
                PrescriptionKind::Intervals,
                Pillar::Cardio,
                5,
                (5, None, Some(60), 30),
            ),
            (
                PrescriptionKind::Intervals,
                Pillar::Cardio,
                6,
                (8, None, Some(60), 20),
            ),
            (
                PrescriptionKind::Intervals,
                Pillar::Proprioception,
                5,
                (4, None, Some(180), 30),
            ),
            (
                PrescriptionKind::Intervals,
                Pillar::Proprioception,
                6,
                (8, None, Some(300), 30),
            ),
        ];
        for (kind, pillar, level, expected) in cases {
            let start = initial_prescription(kind, pillar, level);
            let mut current = start.clone();
            for _ in 0..500 {
                let next = harder_prescription(&current, pillar, level);
                if next == current {
                    break;
                }
                current = next;
            }
            assert_eq!(
                (
                    current.series,
                    current.repetitions,
                    current.effort_seconds,
                    current.rest_seconds
                ),
                expected
            );
            assert!(prescription_at_maximum(&current, pillar, level));
            assert_ne!(easier_prescription(&current, pillar, level), current);
            assert_eq!(easier_prescription(&start, pillar, level), start);
        }
    }
}
