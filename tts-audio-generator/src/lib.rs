pub mod audio;
pub mod config;
pub mod manifest;
pub mod voice;

use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::{Context, Result, bail};

use crate::audio::{AudioMetadata, read_wav_metadata};
use crate::config::{Cue, ResolvedConfig, load_config};
use crate::manifest::{Manifest, ManifestCue, write_manifest_file};
use crate::voice::{VoiceValidation, validate_voice, validate_voice_for_piper};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenerationReport {
    pub audio_files: Vec<PathBuf>,
    pub manifest_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DoctorReport {
    pub checks: Vec<DoctorCheck>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DoctorCheck {
    pub name: &'static str,
    pub ok: bool,
    pub message: String,
}

impl DoctorReport {
    pub fn is_ok(&self) -> bool {
        self.checks.iter().all(|check| check.ok)
    }
}

pub fn validate_config_file(config_path: &Path) -> Result<ResolvedConfig> {
    let config = load_config(config_path)?;
    validate_voice(&config)?;
    validate_synthesizer_command(&config)?;
    Ok(config)
}

pub fn doctor_config_file(config_path: &Path) -> DoctorReport {
    let mut checks = Vec::new();

    let config = match load_config(config_path) {
        Ok(config) => {
            checks.push(DoctorCheck {
                name: "config",
                ok: true,
                message: format!("{} cue(s)", config.cues.len()),
            });
            config
        }
        Err(error) => {
            checks.push(DoctorCheck {
                name: "config",
                ok: false,
                message: error.to_string(),
            });
            return DoctorReport { checks };
        }
    };

    match validate_voice(&config) {
        Ok(voice) => checks.push(DoctorCheck {
            name: "voice",
            ok: true,
            message: format!(
                "{} Hz, license evidence: {}",
                voice.sample_rate_hz, voice.license_line
            ),
        }),
        Err(error) => checks.push(DoctorCheck {
            name: "voice",
            ok: false,
            message: format!("{error:#}"),
        }),
    }

    match validate_synthesizer_command(&config) {
        Ok(()) => checks.push(DoctorCheck {
            name: "synthesizer",
            ok: true,
            message: config.synthesizer.command.clone(),
        }),
        Err(error) => checks.push(DoctorCheck {
            name: "synthesizer",
            ok: false,
            message: format!("{error:#}"),
        }),
    }

    DoctorReport { checks }
}

pub fn generate_from_config(config_path: &Path) -> Result<GenerationReport> {
    generate_with_synthesizer(config_path, &PiperCliSynthesizer)
}

pub fn generate_with_synthesizer(
    config_path: &Path,
    synthesizer: &dyn CueSynthesizer,
) -> Result<GenerationReport> {
    let config = load_config(config_path)?;
    let voice = validate_voice_for_piper(&config)?;

    fs::create_dir_all(&config.output_dir).with_context(|| {
        format!(
            "failed to create output directory {}",
            config.output_dir.display()
        )
    })?;

    let mut rendered = Vec::with_capacity(config.cues.len());
    let mut temp_files = Vec::with_capacity(config.cues.len());

    for cue in &config.cues {
        let final_path = config.output_dir.join(&cue.filename);
        let temp_path = temp_path_for(&final_path);

        if let Some(parent) = temp_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }

        let metadata = match synthesizer.synthesize(SynthesisRequest {
            config: &config,
            voice: &voice,
            cue,
            output_path: &temp_path,
        }) {
            Ok(metadata) => metadata,
            Err(error) => {
                cleanup_temp_files(temp_files.iter().chain(std::iter::once(&temp_path)));
                return Err(error);
            }
        };

        temp_files.push(temp_path.clone());
        rendered.push(GeneratedCue {
            cue_id: cue.id.clone(),
            asset_path: cue.filename.clone(),
            final_path,
            metadata,
        });
    }

    let committed = commit_audio_files(&rendered, &temp_files)?;
    let manifest = Manifest::from_generation(&config, &voice, rendered_to_manifest_cues(&rendered));
    let manifest_path = config.output_dir.join(&config.manifest_filename);
    write_manifest_file(&manifest_path, &manifest)?;

    Ok(GenerationReport {
        audio_files: committed,
        manifest_path,
    })
}

pub trait CueSynthesizer {
    fn synthesize(&self, request: SynthesisRequest<'_>) -> Result<AudioMetadata>;
}

pub struct SynthesisRequest<'a> {
    pub config: &'a ResolvedConfig,
    pub voice: &'a VoiceValidation,
    pub cue: &'a Cue,
    pub output_path: &'a Path,
}

pub struct PiperCliSynthesizer;

impl CueSynthesizer for PiperCliSynthesizer {
    fn synthesize(&self, request: SynthesisRequest<'_>) -> Result<AudioMetadata> {
        let command_config = &request.config.synthesizer;
        let mut command = Command::new(&command_config.command);

        for arg in &command_config.args {
            command.arg(expand_synth_arg(arg, &request));
        }

        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        if command_config.stdin_text {
            command.stdin(Stdio::piped());
        }

        let mut child = command.spawn().with_context(|| {
            format!(
                "failed to start synthesizer `{}`. Install Piper or configure [synthesizer].command",
                command_config.command
            )
        })?;

        if command_config.stdin_text {
            let mut stdin = child
                .stdin
                .take()
                .context("failed to open synthesizer stdin")?;
            stdin
                .write_all(request.cue.text.as_bytes())
                .context("failed to write cue text to synthesizer stdin")?;
            stdin
                .write_all(b"\n")
                .context("failed to finish synthesizer stdin")?;
        }

        let output = child
            .wait_with_output()
            .context("failed while waiting for synthesizer")?;
        if !output.status.success() {
            bail!(
                "synthesizer `{}` failed for cue `{}` with status {}: {}",
                command_config.command,
                request.cue.id,
                output.status,
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }

        let metadata = read_wav_metadata(request.output_path).with_context(|| {
            format!(
                "synthesizer `{}` did not produce a valid WAV for cue `{}` at {}",
                command_config.command,
                request.cue.id,
                request.output_path.display()
            )
        })?;

        if metadata.sample_rate_hz != request.voice.sample_rate_hz {
            bail!(
                "synthesizer output sample rate {} does not match voice_config sample rate {} for cue `{}`",
                metadata.sample_rate_hz,
                request.voice.sample_rate_hz,
                request.cue.id
            );
        }

        Ok(metadata)
    }
}

pub fn validate_synthesizer_command(config: &ResolvedConfig) -> Result<()> {
    let command = &config.synthesizer.command;

    if command.contains(std::path::MAIN_SEPARATOR) {
        let path = Path::new(command);
        let metadata = fs::metadata(path)
            .with_context(|| format!("synthesizer command `{command}` does not exist"))?;
        if !metadata.is_file() {
            bail!("synthesizer command `{command}` is not a file");
        }
        if !is_executable(&metadata) {
            bail!("synthesizer command `{command}` is not executable");
        }
        return Ok(());
    }

    let path_var = std::env::var_os("PATH").context("PATH is not set")?;
    for candidate in std::env::split_paths(&path_var).map(|dir| dir.join(command)) {
        if let Ok(metadata) = fs::metadata(&candidate)
            && metadata.is_file()
            && is_executable(&metadata)
        {
            return Ok(());
        }
    }

    bail!(
        "synthesizer command `{command}` was not found in PATH. Install Piper or configure [synthesizer].command"
    )
}

#[cfg(unix)]
fn is_executable(metadata: &fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn is_executable(metadata: &fs::Metadata) -> bool {
    metadata.is_file()
}

fn expand_synth_arg(arg: &str, request: &SynthesisRequest<'_>) -> String {
    arg.replace(
        "{voice_model}",
        &request.config.voice_model.to_string_lossy(),
    )
    .replace(
        "{voice_config}",
        &request.config.voice_config.to_string_lossy(),
    )
    .replace("{output_file}", &request.output_path.to_string_lossy())
    .replace("{text}", &request.cue.text)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GeneratedCue {
    cue_id: String,
    asset_path: PathBuf,
    final_path: PathBuf,
    metadata: AudioMetadata,
}

fn commit_audio_files(rendered: &[GeneratedCue], temp_files: &[PathBuf]) -> Result<Vec<PathBuf>> {
    let mut committed = Vec::with_capacity(rendered.len());

    for (cue, temp_path) in rendered.iter().zip(temp_files) {
        if let Some(parent) = cue.final_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }

        fs::rename(temp_path, &cue.final_path).with_context(|| {
            format!(
                "failed to commit {} to {}",
                temp_path.display(),
                cue.final_path.display()
            )
        })?;
        committed.push(cue.final_path.clone());
    }

    Ok(committed)
}

fn cleanup_temp_files<'a>(paths: impl Iterator<Item = &'a PathBuf>) {
    for path in paths {
        let _ = fs::remove_file(path);
    }
}

fn rendered_to_manifest_cues(rendered: &[GeneratedCue]) -> Vec<ManifestCue> {
    rendered
        .iter()
        .map(|cue| ManifestCue {
            cue_id: cue.cue_id.clone(),
            asset_path: relative_asset_path(&cue.asset_path),
            format: "wav".to_string(),
            duration_ms: cue.metadata.duration_ms,
            sample_rate_hz: cue.metadata.sample_rate_hz,
        })
        .collect()
}

fn relative_asset_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn temp_path_for(final_path: &Path) -> PathBuf {
    let mut name = final_path
        .file_name()
        .map(|value| value.to_os_string())
        .unwrap_or_else(|| "cue-audio".into());
    name.push(".tmp");
    final_path.with_file_name(name)
}

#[cfg(test)]
mod tests {
    #[cfg(not(feature = "burn-onnx-validation"))]
    use super::*;
    #[cfg(not(feature = "burn-onnx-validation"))]
    use crate::audio::{CueAudio, render_cue_audio, write_wav_file};
    #[cfg(all(unix, not(feature = "burn-onnx-validation")))]
    use std::os::unix::fs::PermissionsExt;
    #[cfg(not(feature = "burn-onnx-validation"))]
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(not(feature = "burn-onnx-validation"))]
    struct TestSynthesizer;

    #[cfg(not(feature = "burn-onnx-validation"))]
    impl CueSynthesizer for TestSynthesizer {
        fn synthesize(&self, request: SynthesisRequest<'_>) -> Result<AudioMetadata> {
            let audio: CueAudio = render_cue_audio(request.cue, request.voice.sample_rate_hz);
            write_wav_file(request.output_path, &audio)?;
            read_wav_metadata(request.output_path)
        }
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    struct FailingSynthesizer;

    #[cfg(not(feature = "burn-onnx-validation"))]
    impl CueSynthesizer for FailingSynthesizer {
        fn synthesize(&self, request: SynthesisRequest<'_>) -> Result<AudioMetadata> {
            let audio: CueAudio = render_cue_audio(request.cue, request.voice.sample_rate_hz);
            write_wav_file(request.output_path, &audio)?;
            anyhow::bail!("synthetic failure")
        }
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    fn temp_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("tts-audio-generator-{name}-{nonce}"))
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    fn write_fixture_config(root: &Path, body: &str) -> PathBuf {
        fs::create_dir_all(root.join("voices/fr_FR")).expect("fixture dirs");
        fs::write(
            root.join("voices/fr_FR/example.onnx"),
            b"Conv Relu Add Tanh",
        )
        .expect("onnx");
        fs::write(
            root.join("voices/fr_FR/example.onnx.json"),
            r#"{"audio":{"sample_rate":16000},"inference":{"noise_scale":0.667}}"#,
        )
        .expect("voice config");
        fs::write(
            root.join("voices/fr_FR/MODEL_CARD.md"),
            "License: CC-BY-4.0\nLanguage: fr_FR\n",
        )
        .expect("model card");
        fs::write(root.join("cues.toml"), body).expect("config");
        root.join("cues.toml")
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    #[test]
    fn generate_writes_audio_and_stable_manifest() {
        let root = temp_root("generate");
        let config_path = write_fixture_config(
            &root,
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[[cues]]
id = "work_start"
text = "C'est parti"
filename = "voice/work-start.wav"

[[cues]]
id = "countdown_3"
text = "3"
filename = "countdown-3.wav"
"#,
        );

        let report = generate_with_synthesizer(&config_path, &TestSynthesizer).expect("generation");

        assert_eq!(report.audio_files.len(), 2);
        assert!(root.join("out/voice/work-start.wav").is_file());
        assert!(root.join("out/countdown-3.wav").is_file());

        let manifest =
            fs::read_to_string(root.join("out/audio-cues.manifest.json")).expect("manifest file");
        let countdown_index = manifest.find("\"countdown_3\"").expect("countdown");
        let work_index = manifest.find("\"work_start\"").expect("work");
        assert!(countdown_index < work_index);
        assert!(manifest.contains("\"work_start\": \"voice/work-start.wav\""));
        assert!(manifest.contains("\"synthesisEngine\": \"piper-cli\""));
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    #[test]
    fn failed_generation_cleans_temp_files_and_skips_manifest() {
        let root = temp_root("failed-generation");
        let config_path = write_fixture_config(
            &root,
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[[cues]]
id = "countdown_3"
text = "3"
filename = "countdown-3.wav"
"#,
        );

        let error = generate_with_synthesizer(&config_path, &FailingSynthesizer)
            .expect_err("generation should fail");

        assert!(error.to_string().contains("synthetic failure"));
        assert!(!root.join("out/countdown-3.wav.tmp").exists());
        assert!(!root.join("out/audio-cues.manifest.json").exists());
        assert!(!root.join("out/countdown-3.wav").exists());
    }

    #[cfg(all(unix, not(feature = "burn-onnx-validation")))]
    #[test]
    fn generate_from_config_invokes_configured_synthesizer_command() {
        let root = temp_root("fake-piper-cli");
        fs::create_dir_all(&root).expect("root");

        let source_wav = root.join("source.wav");
        let cue = Cue {
            id: "work_start".to_string(),
            text: "Go".to_string(),
            filename: "work-start.wav".into(),
        };
        let audio = render_cue_audio(&cue, 16_000);
        write_wav_file(&source_wav, &audio).expect("source wav");

        let fake_piper = root.join("fake-piper.sh");
        fs::write(
            &fake_piper,
            format!(
                "#!/bin/sh\ncat '{}' > \"$1\"\n",
                source_wav.to_string_lossy()
            ),
        )
        .expect("fake piper");
        let mut permissions = fs::metadata(&fake_piper).expect("metadata").permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&fake_piper, permissions).expect("chmod");

        let config_path = write_fixture_config(
            &root,
            &format!(
                r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[synthesizer]
command = "{}"
args = ["{{output_file}}"]
stdin_text = true

[[cues]]
id = "work_start"
text = "Go"
filename = "work-start.wav"
"#,
                fake_piper.to_string_lossy()
            ),
        );

        let report = generate_from_config(&config_path).expect("generation via command");

        assert_eq!(report.audio_files, vec![root.join("out/work-start.wav")]);
        assert!(root.join("out/audio-cues.manifest.json").is_file());
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    #[test]
    fn validate_reports_missing_synthesizer_command() {
        let root = temp_root("missing-synth-command");
        let config_path = write_fixture_config(
            &root,
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[synthesizer]
command = "__acrea_missing_piper_command__"
args = ["{output_file}"]
stdin_text = true

[[cues]]
id = "work_start"
text = "Go"
filename = "work-start.wav"
"#,
        );
        let config = crate::config::load_config(&config_path).expect("config");

        let error = validate_synthesizer_command(&config).expect_err("missing command");

        assert!(error.to_string().contains("was not found in PATH"));
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    #[test]
    fn doctor_reports_synthesizer_failure_without_hiding_voice_success() {
        let root = temp_root("doctor-missing-synth");
        let config_path = write_fixture_config(
            &root,
            r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[synthesizer]
command = "__acrea_missing_piper_command__"
args = ["{output_file}"]
stdin_text = true

[[cues]]
id = "work_start"
text = "Go"
filename = "work-start.wav"
"#,
        );

        let report = doctor_config_file(&config_path);

        assert!(!report.is_ok());
        assert!(
            report
                .checks
                .iter()
                .any(|check| check.name == "config" && check.ok)
        );
        assert!(
            report
                .checks
                .iter()
                .any(|check| check.name == "voice" && check.ok)
        );
        assert!(report.checks.iter().any(|check| check.name == "synthesizer"
            && !check.ok
            && check.message.contains("was not found in PATH")));
    }

    #[cfg(not(feature = "burn-onnx-validation"))]
    #[test]
    fn validate_accepts_explicit_existing_synthesizer_path() {
        let root = temp_root("existing-synth-command");
        let current_exe = std::env::current_exe().expect("current exe");
        let config_path = write_fixture_config(
            &root,
            &format!(
                r#"
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "./out"

[synthesizer]
command = "{}"
args = ["{{output_file}}"]
stdin_text = true

[[cues]]
id = "work_start"
text = "Go"
filename = "work-start.wav"
"#,
                current_exe.to_string_lossy()
            ),
        );
        let config = crate::config::load_config(&config_path).expect("config");

        validate_synthesizer_command(&config).expect("existing command");
    }
}
