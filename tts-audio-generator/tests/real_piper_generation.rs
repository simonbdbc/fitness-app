use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tts_audio_generator::generate_from_config;

#[test]
#[ignore = "requires local Piper plus PIPER_VOICE_MODEL and PIPER_VOICE_CONFIG"]
fn generates_audio_with_real_piper_voice() {
    let voice_model = required_env_path("PIPER_VOICE_MODEL");
    let voice_config = required_env_path("PIPER_VOICE_CONFIG");
    let model_card = std::env::var_os("PIPER_MODEL_CARD")
        .map(PathBuf::from)
        .or_else(|| {
            voice_model
                .parent()
                .map(|parent| parent.join("MODEL_CARD.md"))
        })
        .expect("PIPER_MODEL_CARD or voice model parent");
    let synthesizer_command =
        std::env::var("PIPER_COMMAND").unwrap_or_else(|_| "piper".to_string());

    assert!(
        voice_model.is_file(),
        "{} is missing",
        voice_model.display()
    );
    assert!(
        voice_config.is_file(),
        "{} is missing",
        voice_config.display()
    );
    assert!(model_card.is_file(), "{} is missing", model_card.display());

    let root = temp_root("real-piper");
    fs::create_dir_all(&root).expect("temp root");
    let config_path = root.join("cues.toml");
    fs::write(
        &config_path,
        format!(
            r#"
voice_model = "{}"
voice_config = "{}"
model_card = "{}"
output_dir = "./out"

[synthesizer]
command = "{}"
args = ["--model", "{{voice_model}}", "--config", "{{voice_config}}", "--output_file", "{{output_file}}"]
stdin_text = true

[[cues]]
id = "work_start"
text = "C'est parti"
filename = "work-start.wav"
"#,
            toml_path(&voice_model),
            toml_path(&voice_config),
            toml_path(&model_card),
            synthesizer_command.replace('\\', "\\\\").replace('"', "\\\""),
        ),
    )
    .expect("write config");

    let report = generate_from_config(&config_path).expect("real Piper generation");
    let audio_file = root.join("out/work-start.wav");
    let manifest_file = root.join("out/audio-cues.manifest.json");

    assert_eq!(report.audio_files, vec![audio_file.clone()]);
    assert!(audio_file.is_file(), "{} is missing", audio_file.display());
    assert!(
        manifest_file.is_file(),
        "{} is missing",
        manifest_file.display()
    );

    let audio_bytes = fs::read(&audio_file).expect("audio bytes");
    assert!(audio_bytes.starts_with(b"RIFF"));
    assert!(audio_bytes.len() > 44);

    let manifest = fs::read_to_string(manifest_file).expect("manifest");
    assert!(manifest.contains("\"work_start\""));
    assert!(manifest.contains("\"piper-cli\""));
}

fn required_env_path(name: &str) -> PathBuf {
    std::env::var_os(name)
        .map(PathBuf::from)
        .unwrap_or_else(|| panic!("{name} is required"))
}

fn temp_root(name: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir().join(format!("tts-audio-generator-{name}-{nonce}"))
}

fn toml_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
}
