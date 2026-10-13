use std::path::PathBuf;
use std::process::ExitCode;

use anyhow::{Result, bail};
use tts_audio_generator::{doctor_config_file, generate_from_config, validate_config_file};

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error:#}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let Some(command) = args.next() else {
        print_help();
        return Ok(());
    };

    match command.as_str() {
        "-h" | "--help" | "help" => {
            print_help();
            Ok(())
        }
        "validate" => {
            let config_path = parse_config_path(args.collect())?;
            let config = validate_config_file(&config_path)?;
            println!(
                "valid config: {} cue(s), output {}",
                config.cues.len(),
                config.output_dir.display()
            );
            Ok(())
        }
        "doctor" => {
            let config_path = parse_config_path(args.collect())?;
            let report = doctor_config_file(&config_path);
            for check in &report.checks {
                let status = if check.ok { "ok" } else { "fail" };
                println!("[{status}] {}: {}", check.name, check.message);
            }
            if report.is_ok() {
                Ok(())
            } else {
                bail!(
                    "doctor found {} failing check(s)",
                    report.checks.iter().filter(|check| !check.ok).count()
                )
            }
        }
        "generate" => {
            let config_path = parse_config_path(args.collect())?;
            let report = generate_from_config(&config_path)?;
            println!("generated {} audio file(s)", report.audio_files.len());
            println!("manifest: {}", report.manifest_path.display());
            Ok(())
        }
        other => bail!("unknown command `{other}`. Run with --help."),
    }
}

fn parse_config_path(args: Vec<String>) -> Result<PathBuf> {
    let mut iter = args.into_iter();
    let mut config_path = None;

    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "-c" | "--config" => {
                let Some(value) = iter.next() else {
                    bail!("missing value after {arg}");
                };
                config_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                print_help();
                std::process::exit(0);
            }
            other => bail!("unexpected argument `{other}`"),
        }
    }

    config_path.ok_or_else(|| anyhow::anyhow!("--config <path> is required"))
}

fn print_help() {
    println!(
        "tts-audio-generator\n\nUSAGE:\n  tts-audio-generator doctor --config <path>\n  tts-audio-generator validate --config <path>\n  tts-audio-generator generate --config <path>\n\nCOMMANDS:\n  doctor     Report config, voice, ONNX, license, and synthesizer readiness\n  validate   Validate TOML, voice metadata, ONNX path, MODEL_CARD, and synthesizer command\n  generate   Generate WAV cue assets and audio-cues.manifest.json\n"
    );
}
