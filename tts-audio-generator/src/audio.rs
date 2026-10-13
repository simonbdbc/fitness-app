#[cfg(test)]
use std::f32::consts::PI;
use std::fs;
#[cfg(test)]
use std::io::{BufWriter, Write};
use std::path::Path;

use anyhow::{Context, Result, bail};

#[cfg(test)]
use crate::config::Cue;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AudioMetadata {
    pub sample_rate_hz: u32,
    pub duration_ms: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CueAudio {
    pub sample_rate_hz: u32,
    pub samples: Vec<i16>,
}

impl CueAudio {
    pub fn duration_ms(&self) -> u32 {
        if self.sample_rate_hz == 0 {
            return 0;
        }
        ((self.samples.len() as u64 * 1000) / self.sample_rate_hz as u64) as u32
    }
}

pub fn read_wav_metadata(path: &Path) -> Result<AudioMetadata> {
    let bytes = fs::read(path).with_context(|| format!("failed to read {}", path.display()))?;
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        bail!("{} is not a RIFF/WAVE file", path.display());
    }

    let mut offset = 12usize;
    let mut sample_rate_hz = None;
    let mut byte_rate = None;
    let mut data_len = None;

    while offset + 8 <= bytes.len() {
        let chunk_id = &bytes[offset..offset + 4];
        let chunk_len = u32::from_le_bytes([
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7],
        ]) as usize;
        let chunk_start = offset + 8;
        let chunk_end = chunk_start.saturating_add(chunk_len);

        if chunk_end > bytes.len() {
            bail!("{} has a truncated WAV chunk", path.display());
        }

        match chunk_id {
            b"fmt " => {
                if chunk_len < 16 {
                    bail!("{} has an invalid fmt chunk", path.display());
                }
                let audio_format = u16::from_le_bytes([bytes[chunk_start], bytes[chunk_start + 1]]);
                if audio_format != 1 {
                    bail!(
                        "{} must be PCM WAV, got format {}",
                        path.display(),
                        audio_format
                    );
                }
                sample_rate_hz = Some(u32::from_le_bytes([
                    bytes[chunk_start + 4],
                    bytes[chunk_start + 5],
                    bytes[chunk_start + 6],
                    bytes[chunk_start + 7],
                ]));
                byte_rate = Some(u32::from_le_bytes([
                    bytes[chunk_start + 8],
                    bytes[chunk_start + 9],
                    bytes[chunk_start + 10],
                    bytes[chunk_start + 11],
                ]));
            }
            b"data" => data_len = Some(chunk_len as u32),
            _ => {}
        }

        offset = chunk_end + (chunk_len % 2);
    }

    let sample_rate_hz =
        sample_rate_hz.with_context(|| format!("{} is missing fmt chunk", path.display()))?;
    let byte_rate =
        byte_rate.with_context(|| format!("{} is missing byte rate", path.display()))?;
    let data_len = data_len.with_context(|| format!("{} is missing data chunk", path.display()))?;

    if byte_rate == 0 {
        bail!("{} has zero byte rate", path.display());
    }

    Ok(AudioMetadata {
        sample_rate_hz,
        duration_ms: ((data_len as u64 * 1000) / byte_rate as u64) as u32,
    })
}

#[cfg(test)]
pub fn render_cue_audio(cue: &Cue, sample_rate_hz: u32) -> CueAudio {
    let safe_sample_rate = sample_rate_hz.clamp(8_000, 96_000);
    let mut samples = Vec::new();

    let mut text_units = cue.text.chars().filter(|ch| !ch.is_whitespace()).peekable();
    if text_units.peek().is_none() {
        samples.extend(silence(safe_sample_rate, 300));
    }

    for ch in text_units {
        let frequency = 320.0 + (ch as u32 % 42) as f32 * 18.0;
        samples.extend(sine_tone(safe_sample_rate, frequency, 70));
        samples.extend(silence(safe_sample_rate, 22));
    }

    samples.extend(silence(safe_sample_rate, 120));

    CueAudio {
        sample_rate_hz: safe_sample_rate,
        samples,
    }
}

#[cfg(test)]
pub fn write_wav_file(path: &Path, audio: &CueAudio) -> Result<()> {
    let file = fs::File::create(path)
        .with_context(|| format!("failed to create WAV file {}", path.display()))?;
    let mut writer = BufWriter::new(file);

    let channel_count = 1u16;
    let bits_per_sample = 16u16;
    let bytes_per_sample = bits_per_sample / 8;
    let data_len = audio.samples.len() as u32 * bytes_per_sample as u32;
    let byte_rate = audio.sample_rate_hz * channel_count as u32 * bytes_per_sample as u32;
    let block_align = channel_count * bytes_per_sample;
    let riff_len = 36u32 + data_len;

    writer.write_all(b"RIFF")?;
    writer.write_all(&riff_len.to_le_bytes())?;
    writer.write_all(b"WAVE")?;
    writer.write_all(b"fmt ")?;
    writer.write_all(&16u32.to_le_bytes())?;
    writer.write_all(&1u16.to_le_bytes())?;
    writer.write_all(&channel_count.to_le_bytes())?;
    writer.write_all(&audio.sample_rate_hz.to_le_bytes())?;
    writer.write_all(&byte_rate.to_le_bytes())?;
    writer.write_all(&block_align.to_le_bytes())?;
    writer.write_all(&bits_per_sample.to_le_bytes())?;
    writer.write_all(b"data")?;
    writer.write_all(&data_len.to_le_bytes())?;

    for sample in &audio.samples {
        writer.write_all(&sample.to_le_bytes())?;
    }

    writer.flush()?;
    Ok(())
}

#[cfg(test)]
fn sine_tone(sample_rate_hz: u32, frequency: f32, duration_ms: u32) -> Vec<i16> {
    let sample_count = (sample_rate_hz as u64 * duration_ms as u64 / 1000) as usize;
    let attack_samples = (sample_rate_hz as f32 * 0.005) as usize;
    let release_samples = attack_samples;

    (0..sample_count)
        .map(|index| {
            let t = index as f32 / sample_rate_hz as f32;
            let envelope = if index < attack_samples {
                index as f32 / attack_samples.max(1) as f32
            } else if index + release_samples >= sample_count {
                (sample_count.saturating_sub(index) as f32 / release_samples.max(1) as f32)
                    .clamp(0.0, 1.0)
            } else {
                1.0
            };
            let value = (2.0 * PI * frequency * t).sin() * envelope * 0.25;
            (value * i16::MAX as f32) as i16
        })
        .collect()
}

#[cfg(test)]
fn silence(sample_rate_hz: u32, duration_ms: u32) -> Vec<i16> {
    let sample_count = (sample_rate_hz as u64 * duration_ms as u64 / 1000) as usize;
    vec![0; sample_count]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_file(name: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!("tts-audio-{name}-{nonce}.wav"))
    }

    #[test]
    fn writes_readable_wav_header() {
        let cue = Cue {
            id: "work_start".to_string(),
            text: "Go".to_string(),
            filename: "work-start.wav".into(),
        };
        let audio = render_cue_audio(&cue, 16_000);
        let path = temp_file("header");

        write_wav_file(&path, &audio).expect("wav write");

        let bytes = fs::read(path).expect("wav bytes");
        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
        assert_eq!(&bytes[12..16], b"fmt ");
        assert_eq!(&bytes[36..40], b"data");
        assert!(audio.duration_ms() > 100);
    }
}
