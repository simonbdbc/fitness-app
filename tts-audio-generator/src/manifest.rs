use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use serde::Serialize;

use crate::config::ResolvedConfig;
use crate::voice::{BURN_ONNX_VERSION, BURN_VERSION, VoiceValidation};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub version: u8,
    pub generated_by: String,
    pub synthesis_engine: String,
    pub burn_version: String,
    pub burn_onnx_version: String,
    pub voice: ManifestVoice,
    pub assets: BTreeMap<String, String>,
    pub cues: Vec<ManifestCue>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestVoice {
    pub model_path: String,
    pub config_path: String,
    pub model_card_path: String,
    pub license: String,
    pub sample_rate_hz: u32,
    pub burn_onnx_feature_enabled: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestCue {
    pub cue_id: String,
    pub asset_path: String,
    pub format: String,
    pub duration_ms: u32,
    pub sample_rate_hz: u32,
}

impl Manifest {
    pub fn from_generation(
        _config: &ResolvedConfig,
        voice: &VoiceValidation,
        mut cues: Vec<ManifestCue>,
    ) -> Self {
        cues.sort_by(|left, right| left.cue_id.cmp(&right.cue_id));
        let assets = cues
            .iter()
            .map(|cue| (cue.cue_id.clone(), cue.asset_path.clone()))
            .collect();

        Self {
            version: 1,
            generated_by: "tts-audio-generator".to_string(),
            synthesis_engine: "piper-cli".to_string(),
            burn_version: BURN_VERSION.to_string(),
            burn_onnx_version: BURN_ONNX_VERSION.to_string(),
            voice: ManifestVoice {
                model_path: voice.model_path.to_string_lossy().into_owned(),
                config_path: voice.config_path.to_string_lossy().into_owned(),
                model_card_path: voice.model_card_path.to_string_lossy().into_owned(),
                license: voice.license_line.clone(),
                sample_rate_hz: voice.sample_rate_hz,
                burn_onnx_feature_enabled: voice.burn_onnx_feature_enabled,
            },
            assets,
            cues,
        }
    }
}

pub fn write_manifest_file(path: &Path, manifest: &Manifest) -> Result<()> {
    let temp_path = path.with_extension("json.tmp");
    if let Some(parent) = temp_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    let content = serde_json::to_string_pretty(manifest)?;
    fs::write(&temp_path, format!("{content}\n"))
        .with_context(|| format!("failed to write {}", temp_path.display()))?;
    fs::rename(&temp_path, path).with_context(|| {
        format!(
            "failed to commit manifest {} to {}",
            temp_path.display(),
            path.display()
        )
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_assets_are_sorted_by_cue_id() {
        let voice = VoiceValidation {
            model_path: "voice.onnx".into(),
            config_path: "voice.onnx.json".into(),
            model_card_path: "MODEL_CARD.md".into(),
            license_line: "License: CC-BY-4.0".to_string(),
            sample_rate_hz: 16_000,
            onnx_operator_names: vec![],
            burn_onnx_feature_enabled: false,
        };
        let config = ResolvedConfig {
            config_path: "cues.toml".into(),
            config_dir: ".".into(),
            voice_model: "voice.onnx".into(),
            voice_config: "voice.onnx.json".into(),
            model_card: None,
            output_dir: "out".into(),
            manifest_filename: "audio-cues.manifest.json".into(),
            synthesizer: crate::config::SynthesizerCommand {
                command: "piper".to_string(),
                args: vec![
                    "--model".to_string(),
                    "{voice_model}".to_string(),
                    "--output_file".to_string(),
                    "{output_file}".to_string(),
                ],
                stdin_text: true,
            },
            cues: vec![],
        };

        let manifest = Manifest::from_generation(
            &config,
            &voice,
            vec![
                ManifestCue {
                    cue_id: "work_start".to_string(),
                    asset_path: "work-start.wav".to_string(),
                    format: "wav".to_string(),
                    duration_ms: 100,
                    sample_rate_hz: 16_000,
                },
                ManifestCue {
                    cue_id: "countdown_3".to_string(),
                    asset_path: "countdown-3.wav".to_string(),
                    format: "wav".to_string(),
                    duration_ms: 100,
                    sample_rate_hz: 16_000,
                },
            ],
        );

        let keys: Vec<_> = manifest.assets.keys().cloned().collect();
        assert_eq!(keys, vec!["countdown_3", "work_start"]);
        assert_eq!(
            manifest.assets.get("work_start").map(String::as_str),
            Some("work-start.wav")
        );
    }
}
