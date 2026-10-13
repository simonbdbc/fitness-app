use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PillarLevels {
    pub strength: u8,
    #[serde(alias = "hiit")]
    pub cardio: u8,
    #[serde(alias = "callisthenie")]
    pub proprioception: u8,
}

#[derive(Clone, Debug, Serialize)]
pub struct Profile {
    pub id: &'static str,
    pub name: &'static str,
    pub objective: &'static str,
    pub equipment_mode: &'static str,
    pub weekly_frequency: u8,
    pub session_minutes_min: u16,
    pub session_minutes_max: u16,
    pub weekly_novelty_percent: u8,
    pub level_test_completed: bool,
    pub pillar_levels: PillarLevels,
    pub available_equipment: Vec<&'static str>,
    pub active_variant_tags: Vec<&'static str>,
    pub restrictions: Vec<&'static str>,
}

pub fn demo_profile() -> Profile {
    Profile {
        id: "demo-profile",
        name: "Profil demo",
        objective: "Developper le renforcement au poids du corps sans se blesser.",
        equipment_mode: "aucun",
        weekly_frequency: 3,
        session_minutes_min: 30,
        session_minutes_max: 45,
        weekly_novelty_percent: 50,
        level_test_completed: false,
        pillar_levels: PillarLevels {
            strength: 2,
            cardio: 2,
            proprioception: 1,
        },
        available_equipment: vec![],
        active_variant_tags: vec!["constraint:low_impact"],
        restrictions: vec!["tirage strict limite sans support"],
    }
}
