use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(feature = "burn-onnx-validation")]
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result, bail};
use serde_json::Value;

use crate::config::ResolvedConfig;

pub const BURN_VERSION: &str = "0.21.0";
pub const BURN_ONNX_VERSION: &str = "0.21.0";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VoiceValidation {
    pub model_path: PathBuf,
    pub config_path: PathBuf,
    pub model_card_path: PathBuf,
    pub license_line: String,
    pub sample_rate_hz: u32,
    pub onnx_operator_names: Vec<String>,
    pub burn_onnx_feature_enabled: bool,
}

pub fn validate_voice(config: &ResolvedConfig) -> Result<VoiceValidation> {
    validate_voice_inner(config, true)
}

pub fn validate_voice_for_piper(config: &ResolvedConfig) -> Result<VoiceValidation> {
    validate_voice_inner(config, false)
}

fn validate_voice_inner(
    config: &ResolvedConfig,
    require_burn_compatibility: bool,
) -> Result<VoiceValidation> {
    ensure_file(&config.voice_model, "voice_model")?;
    ensure_file(&config.voice_config, "voice_config")?;

    if config
        .voice_model
        .extension()
        .and_then(|value| value.to_str())
        != Some("onnx")
    {
        bail!(
            "voice_model must point to a Piper ONNX file, got {}",
            config.voice_model.display()
        );
    }

    let voice_config_source = fs::read_to_string(&config.voice_config)
        .with_context(|| format!("failed to read {}", config.voice_config.display()))?;
    let voice_config_json: Value = serde_json::from_str(&voice_config_source)
        .with_context(|| format!("failed to parse {}", config.voice_config.display()))?;
    let sample_rate_hz = sample_rate_from_voice_config(&voice_config_json)?;

    let model_card_path = find_model_card(config)?;
    let model_card = fs::read_to_string(&model_card_path)
        .with_context(|| format!("failed to read {}", model_card_path.display()))?;
    let license_line = extract_license_line(&model_card).with_context(|| {
        format!(
            "MODEL_CARD {} must document the voice license",
            model_card_path.display()
        )
    })?;

    let model_bytes = fs::read(&config.voice_model)
        .with_context(|| format!("failed to read {}", config.voice_model.display()))?;
    if model_bytes.is_empty() {
        bail!("voice_model {} is empty", config.voice_model.display());
    }
    let onnx_operator_names = scan_onnx_operator_names(&model_bytes);
    if require_burn_compatibility {
        validate_supported_operator_scan(&onnx_operator_names)?;
        validate_burn_onnx_import(&config.voice_model)?;
    }

    Ok(VoiceValidation {
        model_path: config.voice_model.clone(),
        config_path: config.voice_config.clone(),
        model_card_path,
        license_line,
        sample_rate_hz,
        onnx_operator_names,
        burn_onnx_feature_enabled: require_burn_compatibility
            && cfg!(feature = "burn-onnx-validation"),
    })
}

fn ensure_file(path: &Path, field: &'static str) -> Result<()> {
    let metadata =
        fs::metadata(path).with_context(|| format!("{field} {} is missing", path.display()))?;
    if !metadata.is_file() {
        bail!("{field} {} must be a file", path.display());
    }
    Ok(())
}

#[cfg(feature = "burn-onnx-validation")]
fn validate_burn_onnx_import(model_path: &Path) -> Result<()> {
    use std::panic::{AssertUnwindSafe, catch_unwind};

    let model = model_path.to_str().with_context(|| {
        format!(
            "voice_model path {} is not valid UTF-8",
            model_path.display()
        )
    })?;
    let output_dir = temporary_burn_onnx_dir();
    fs::create_dir_all(&output_dir)
        .with_context(|| format!("failed to create {}", output_dir.display()))?;
    let output = output_dir.to_str().with_context(|| {
        format!(
            "temporary burn-onnx output path {} is not valid UTF-8",
            output_dir.display()
        )
    })?;

    let result = catch_unwind(AssertUnwindSafe(|| {
        burn_onnx::ModelGen::new()
            .input(model)
            .out_dir(output)
            .development(false)
            .simplify(true)
            .partition(true)
            .load_strategy(burn_onnx::LoadStrategy::None)
            .run_from_cli();
    }));

    let _ = fs::remove_dir_all(&output_dir);

    if result.is_err() {
        bail!(
            "burn-onnx {BURN_ONNX_VERSION} failed to import {}; the voice is not compatible yet",
            model_path.display()
        );
    }

    Ok(())
}

#[cfg(not(feature = "burn-onnx-validation"))]
fn validate_burn_onnx_import(_model_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(feature = "burn-onnx-validation")]
fn temporary_burn_onnx_dir() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir().join(format!("tts-audio-generator-burn-onnx-{nonce}"))
}

fn sample_rate_from_voice_config(value: &Value) -> Result<u32> {
    let Some(sample_rate) = value
        .pointer("/audio/sample_rate")
        .or_else(|| value.pointer("/sample_rate"))
        .and_then(|value| value.as_u64())
    else {
        bail!("voice_config must contain audio.sample_rate or sample_rate");
    };

    if !(8_000..=96_000).contains(&sample_rate) {
        bail!("voice_config sample_rate {sample_rate} is outside 8000..=96000");
    }

    Ok(sample_rate as u32)
}

fn find_model_card(config: &ResolvedConfig) -> Result<PathBuf> {
    if let Some(path) = &config.model_card {
        ensure_file(path, "model_card")?;
        return Ok(path.clone());
    }

    let mut candidates = Vec::new();
    if let Some(parent) = config.voice_model.parent() {
        candidates.push(parent.join("MODEL_CARD.md"));
        candidates.push(parent.join("MODEL_CARD"));
        candidates.push(parent.join("README.md"));
    }
    if let Some(parent) = config.voice_config.parent() {
        candidates.push(parent.join("MODEL_CARD.md"));
        candidates.push(parent.join("MODEL_CARD"));
        candidates.push(parent.join("README.md"));
    }

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    bail!("no MODEL_CARD found next to the voice model/configuration");
}

fn extract_license_line(source: &str) -> Result<String> {
    source
        .lines()
        .map(str::trim)
        .find(|line| {
            let lower = line.to_ascii_lowercase();
            lower.contains("license") || lower.contains("licence")
        })
        .map(ToOwned::to_owned)
        .ok_or_else(|| anyhow::anyhow!("missing license line"))
}

fn scan_onnx_operator_names(model_bytes: &[u8]) -> Vec<String> {
    let known_ops = known_onnx_ops();
    let source = String::from_utf8_lossy(model_bytes);
    let mut found = BTreeSet::new();

    for token in source
        .split(|ch: char| !(ch.is_ascii_alphanumeric() || ch == '_'))
        .filter(|token| token.len() >= 2)
    {
        if known_ops.contains(token) {
            found.insert(token.to_string());
        }
    }

    found.into_iter().collect()
}

fn validate_supported_operator_scan(operator_names: &[String]) -> Result<()> {
    let supported = supported_static_burn_onnx_ops();
    let unsupported: Vec<&str> = operator_names
        .iter()
        .map(String::as_str)
        .filter(|operator| !supported.contains(operator))
        .collect();

    if !unsupported.is_empty() {
        bail!(
            "voice_model contains ONNX operator(s) not allowed by the static Burn ONNX gate: {}",
            unsupported.join(", ")
        );
    }

    Ok(())
}

fn known_onnx_ops() -> BTreeSet<&'static str> {
    [
        "Abs",
        "Acos",
        "Add",
        "And",
        "ArgMax",
        "AveragePool",
        "BatchNormalization",
        "Cast",
        "Ceil",
        "Clip",
        "Concat",
        "Constant",
        "ConstantOfShape",
        "Conv",
        "Cos",
        "Div",
        "Dropout",
        "Equal",
        "Erf",
        "Exp",
        "Expand",
        "Flatten",
        "Floor",
        "Gather",
        "Gemm",
        "GlobalAveragePool",
        "Greater",
        "Identity",
        "InstanceNormalization",
        "LayerNormalization",
        "LeakyRelu",
        "Less",
        "Log",
        "MatMul",
        "MaxPool",
        "Mul",
        "Neg",
        "Not",
        "Or",
        "Pad",
        "Pow",
        "Range",
        "RandomNormal",
        "RandomNormalLike",
        "RandomUniform",
        "RandomUniformLike",
        "Reciprocal",
        "ReduceMean",
        "Relu",
        "Reshape",
        "Resize",
        "Shape",
        "Sigmoid",
        "Sin",
        "Slice",
        "Softmax",
        "Split",
        "Sqrt",
        "Squeeze",
        "Sub",
        "Sum",
        "Tanh",
        "Tile",
        "Transpose",
        "Unsqueeze",
        "Where",
    ]
    .into_iter()
    .collect()
}

fn supported_static_burn_onnx_ops() -> BTreeSet<&'static str> {
    [
        "Abs",
        "Add",
        "Cast",
        "Concat",
        "Constant",
        "Conv",
        "Div",
        "Equal",
        "Exp",
        "Expand",
        "Gather",
        "Gemm",
        "Greater",
        "Less",
        "Log",
        "MatMul",
        "Mul",
        "Neg",
        "Pad",
        "Pow",
        "Range",
        "ReduceMean",
        "Relu",
        "Reshape",
        "Shape",
        "Sigmoid",
        "Slice",
        "Softmax",
        "Split",
        "Sqrt",
        "Squeeze",
        "Sub",
        "Sum",
        "Tanh",
        "Tile",
        "Transpose",
        "Unsqueeze",
        "Where",
    ]
    .into_iter()
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::load_config;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("tts-voice-{name}-{nonce}"))
    }

    fn fixture_config(root: &Path, model_bytes: &[u8], model_card: &str) -> ResolvedConfig {
        fs::create_dir_all(root.join("voices/fr_FR")).expect("fixture dirs");
        fs::write(root.join("voices/fr_FR/example.onnx"), model_bytes).expect("onnx");
        fs::write(
            root.join("voices/fr_FR/example.onnx.json"),
            r#"{"audio":{"sample_rate":22050}}"#,
        )
        .expect("voice config");
        fs::write(root.join("voices/fr_FR/MODEL_CARD.md"), model_card).expect("model card");
        let config_path = root.join("cues.toml");
        fs::write(
            &config_path,
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[[cues]]
id = "work_start"
text = "Go"
filename = "work-start.wav"
"#,
        )
        .expect("config");
        load_config(&config_path).expect("resolved config")
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    #[test]
    fn validates_voice_metadata_and_license() {
        let root = temp_root("valid");
        let config = fixture_config(&root, b"Conv Relu Add Tanh", "License: CC-BY-4.0\n");

        let validation = validate_voice(&config).expect("valid voice");

        assert_eq!(validation.sample_rate_hz, 22050);
        assert_eq!(validation.license_line, "License: CC-BY-4.0");
        assert!(validation.onnx_operator_names.contains(&"Conv".to_string()));
    }

    #[test]
    fn rejects_model_card_without_license() {
        let root = temp_root("license");
        let config = fixture_config(&root, b"Conv Relu", "Language: fr_FR\n");

        let error = validate_voice(&config).expect_err("missing license");
        assert!(error.to_string().contains("MODEL_CARD"));
    }

    #[test]
    fn rejects_unsupported_operator_scan() {
        let root = temp_root("unsupported-op");
        let config = fixture_config(&root, b"Conv RandomNormal", "License: CC0\n");

        let error = validate_voice(&config).expect_err("unsupported op");
        assert!(error.to_string().contains("RandomNormal"));
    }

    #[test]
    fn piper_validation_accepts_operators_not_supported_by_burn() {
        let root = temp_root("piper-operators");
        let config = fixture_config(
            &root,
            b"Conv RandomNormalLike Sin Erf",
            "License: CC-BY-4.0\n",
        );

        let validation = validate_voice_for_piper(&config).expect("Piper-compatible voice");

        assert_eq!(validation.sample_rate_hz, 22050);
        assert!(!validation.burn_onnx_feature_enabled);
        assert!(
            validation
                .onnx_operator_names
                .contains(&"RandomNormalLike".to_string())
        );
    }
}
