use std::collections::BTreeSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("failed to read config {path}: {source}")]
    Read {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse TOML config {path}: {source}")]
    Parse {
        path: PathBuf,
        #[source]
        source: toml::de::Error,
    },
    #[error("config must contain at least one cue")]
    NoCues,
    #[error("cue `{field}` at index {index} must not be empty")]
    EmptyCueField { index: usize, field: &'static str },
    #[error("cue id `{id}` at index {index} must match [a-z][A-Za-z0-9_]*")]
    InvalidCueId { index: usize, id: String },
    #[error("duplicate cue id `{id}`")]
    DuplicateCueId { id: String },
    #[error("duplicate cue filename `{filename}`")]
    DuplicateFilename { filename: String },
    #[error("{field} path `{path}` must be relative and stay inside output_dir")]
    UnsafeRelativePath { field: &'static str, path: String },
    #[error("synthesizer command must not be empty")]
    EmptySynthesizerCommand,
    #[error("synthesizer args must contain `{{output_file}}`")]
    SynthesizerMissingOutputFile,
    #[error("synthesizer must pass cue text either through stdin_text or a `{{text}}` arg")]
    SynthesizerMissingText,
}

#[derive(Debug, Deserialize)]
struct RawConfig {
    voice_model: PathBuf,
    voice_config: PathBuf,
    model_card: Option<PathBuf>,
    output_dir: PathBuf,
    manifest_filename: Option<PathBuf>,
    synthesizer: Option<RawSynthesizer>,
    cues: Vec<RawCue>,
}

#[derive(Debug, Deserialize)]
struct RawSynthesizer {
    command: Option<String>,
    args: Option<Vec<String>>,
    stdin_text: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct RawCue {
    id: String,
    text: String,
    filename: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedConfig {
    pub config_path: PathBuf,
    pub config_dir: PathBuf,
    pub voice_model: PathBuf,
    pub voice_config: PathBuf,
    pub model_card: Option<PathBuf>,
    pub output_dir: PathBuf,
    pub manifest_filename: PathBuf,
    pub synthesizer: SynthesizerCommand,
    pub cues: Vec<Cue>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SynthesizerCommand {
    pub command: String,
    pub args: Vec<String>,
    pub stdin_text: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cue {
    pub id: String,
    pub text: String,
    pub filename: PathBuf,
}

pub fn load_config(path: &Path) -> Result<ResolvedConfig, ConfigError> {
    let source = fs::read_to_string(path).map_err(|source| ConfigError::Read {
        path: path.to_path_buf(),
        source,
    })?;
    let raw: RawConfig = toml::from_str(&source).map_err(|source| ConfigError::Parse {
        path: path.to_path_buf(),
        source,
    })?;

    let config_dir = path.parent().unwrap_or_else(|| Path::new("."));
    validate_raw(path, config_dir, raw)
}

fn validate_raw(
    config_path: &Path,
    config_dir: &Path,
    raw: RawConfig,
) -> Result<ResolvedConfig, ConfigError> {
    if raw.cues.is_empty() {
        return Err(ConfigError::NoCues);
    }

    let mut ids = BTreeSet::new();
    let mut filenames = BTreeSet::new();
    let mut cues = Vec::with_capacity(raw.cues.len());

    for (index, cue) in raw.cues.into_iter().enumerate() {
        let id = cue.id.trim().to_string();
        let text = cue.text.trim().to_string();

        if id.is_empty() {
            return Err(ConfigError::EmptyCueField { index, field: "id" });
        }
        if text.is_empty() {
            return Err(ConfigError::EmptyCueField {
                index,
                field: "text",
            });
        }
        if !is_valid_cue_id(&id) {
            return Err(ConfigError::InvalidCueId { index, id });
        }
        if !ids.insert(id.clone()) {
            return Err(ConfigError::DuplicateCueId { id });
        }

        let filename = normalize_output_relative_path("filename", &cue.filename)?;
        let filename_key = filename.to_string_lossy().into_owned();
        if !filenames.insert(filename_key.clone()) {
            return Err(ConfigError::DuplicateFilename {
                filename: filename_key,
            });
        }

        cues.push(Cue { id, text, filename });
    }

    cues.sort_by(|left, right| left.id.cmp(&right.id));

    let manifest_filename = raw
        .manifest_filename
        .unwrap_or_else(|| PathBuf::from("audio-cues.manifest.json"));
    let manifest_filename =
        normalize_output_relative_path("manifest_filename", &manifest_filename)?;
    let synthesizer = validate_synthesizer(raw.synthesizer)?;

    let config_dir = normalize_lexical(config_dir.to_path_buf());
    Ok(ResolvedConfig {
        config_path: normalize_lexical(config_path.to_path_buf()),
        voice_model: resolve_path(&config_dir, &raw.voice_model),
        voice_config: resolve_path(&config_dir, &raw.voice_config),
        model_card: raw
            .model_card
            .as_ref()
            .map(|path| resolve_path(&config_dir, path)),
        output_dir: resolve_path(&config_dir, &raw.output_dir),
        config_dir,
        manifest_filename,
        synthesizer,
        cues,
    })
}

fn validate_synthesizer(raw: Option<RawSynthesizer>) -> Result<SynthesizerCommand, ConfigError> {
    let raw = raw.unwrap_or(RawSynthesizer {
        command: None,
        args: None,
        stdin_text: None,
    });
    let command = raw.command.unwrap_or_else(|| "piper".to_string());
    let command = command.trim().to_string();

    if command.is_empty() {
        return Err(ConfigError::EmptySynthesizerCommand);
    }

    let args = raw.args.unwrap_or_else(|| {
        vec![
            "--model".to_string(),
            "{voice_model}".to_string(),
            "--config".to_string(),
            "{voice_config}".to_string(),
            "--output_file".to_string(),
            "{output_file}".to_string(),
        ]
    });
    let stdin_text = raw.stdin_text.unwrap_or(true);

    if !args.iter().any(|arg| arg.contains("{output_file}")) {
        return Err(ConfigError::SynthesizerMissingOutputFile);
    }

    if !stdin_text && !args.iter().any(|arg| arg.contains("{text}")) {
        return Err(ConfigError::SynthesizerMissingText);
    }

    Ok(SynthesizerCommand {
        command,
        args,
        stdin_text,
    })
}

fn resolve_path(base: &Path, value: &Path) -> PathBuf {
    if value.is_absolute() {
        normalize_lexical(value.to_path_buf())
    } else {
        normalize_lexical(base.join(value))
    }
}

fn normalize_output_relative_path(
    field: &'static str,
    path: &Path,
) -> Result<PathBuf, ConfigError> {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::Normal(part) if !part.is_empty() => normalized.push(part),
            Component::CurDir => {}
            _ => {
                return Err(ConfigError::UnsafeRelativePath {
                    field,
                    path: path.to_string_lossy().into_owned(),
                });
            }
        }
    }

    if normalized.as_os_str().is_empty() {
        return Err(ConfigError::UnsafeRelativePath {
            field,
            path: path.to_string_lossy().into_owned(),
        });
    }

    Ok(normalized)
}

fn normalize_lexical(path: PathBuf) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(Path::new("/")),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(part) => normalized.push(part),
        }
    }

    normalized
}

fn is_valid_cue_id(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_lowercase() && chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("tts-config-{name}-{nonce}"))
    }

    fn write_config(root: &Path, body: &str) -> PathBuf {
        fs::create_dir_all(root).expect("root");
        let path = root.join("cues.toml");
        fs::write(&path, body).expect("config");
        path
    }

    fn valid_config_body(extra_cue: &str) -> String {
        format!(
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "../apps/pwa/assets/audio/cues"

[[cues]]
id = "countdown_3"
text = "3"
filename = "countdown-3.wav"
{extra_cue}
"#
        )
    }

    #[test]
    fn parses_and_sorts_valid_cues() {
        let root = temp_root("valid");
        let path = write_config(
            &root,
            &valid_config_body(
                r#"
[[cues]]
id = "block_complete"
text = "Bloc termine"
filename = "block-complete.wav"
"#,
            ),
        );

        let config = load_config(&path).expect("valid config");

        assert_eq!(config.cues[0].id, "block_complete");
        assert_eq!(config.cues[1].id, "countdown_3");
        assert!(config.output_dir.ends_with("apps/pwa/assets/audio/cues"));
        assert_eq!(config.synthesizer.command, "piper");
        assert!(config.synthesizer.stdin_text);
        assert!(
            config
                .synthesizer
                .args
                .iter()
                .any(|arg| arg.contains("{output_file}"))
        );
    }

    #[test]
    fn rejects_duplicate_ids() {
        let root = temp_root("duplicate-id");
        let path = write_config(
            &root,
            &valid_config_body(
                r#"
[[cues]]
id = "countdown_3"
text = "trois"
filename = "countdown-three.wav"
"#,
            ),
        );

        let error = load_config(&path).expect_err("duplicate id");
        assert!(matches!(error, ConfigError::DuplicateCueId { .. }));
    }

    #[test]
    fn rejects_filename_traversal() {
        let root = temp_root("traversal");
        let path = write_config(
            &root,
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[[cues]]
id = "work_start"
text = "go"
filename = "../outside.wav"
"#,
        );

        let error = load_config(&path).expect_err("traversal");
        assert!(matches!(error, ConfigError::UnsafeRelativePath { .. }));
    }

    #[test]
    fn rejects_invalid_ids() {
        let root = temp_root("invalid-id");
        let path = write_config(
            &root,
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[[cues]]
id = "Work-Start"
text = "go"
filename = "work-start.wav"
"#,
        );

        let error = load_config(&path).expect_err("invalid id");
        assert!(matches!(error, ConfigError::InvalidCueId { .. }));
    }

    #[test]
    fn accepts_camel_case_ids_used_by_the_app() {
        let root = temp_root("camel-case-id");
        let path = write_config(
            &root,
            &valid_config_body(
                r#"
[[cues]]
id = "exerciseStart"
text = "Debut de l'exercice"
filename = "exerciseStart.wav"
"#,
            ),
        );

        let config = load_config(&path).expect("camelCase cue id");
        assert!(config.cues.iter().any(|cue| cue.id == "exerciseStart"));
    }

    #[test]
    fn rejects_synthesizer_without_text_source() {
        let root = temp_root("invalid-synth");
        let path = write_config(
            &root,
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[synthesizer]
command = "python3"
args = ["-m", "piper", "-m", "{voice_model}", "-f", "{output_file}"]
stdin_text = false

[[cues]]
id = "work_start"
text = "go"
filename = "work-start.wav"
"#,
        );

        let error = load_config(&path).expect_err("missing text source");
        assert!(matches!(error, ConfigError::SynthesizerMissingText));
    }
}
