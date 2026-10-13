# TTS audio generator

`tts-audio-generator` is a standalone Rust CLI used to produce offline audio
cue assets for the Expo app. It is intentionally separate from
`fitness-service` and from `apps/pwa` runtime code.

The app consumes the generated audio files and manifest as static assets. It
does not generate speech at runtime.

## Commands

```bash
cargo run --manifest-path tts-audio-generator/Cargo.toml -- doctor --config tts-audio-generator/examples/cues.toml
cargo run --manifest-path tts-audio-generator/Cargo.toml -- validate --config tts-audio-generator/examples/cues.toml
cargo run --manifest-path tts-audio-generator/Cargo.toml -- generate --config tts-audio-generator/examples/cues.toml
```

`doctor` reports every readiness check separately. `validate` performs the same
checks but exits on the first failure.

`validate` checks:

- TOML shape and required fields;
- cue IDs, cue text and filenames;
- output paths staying inside `output_dir`;
- voice model and voice config files;
- `MODEL_CARD` license evidence;
- configured synthesizer command existence and executable bit;
- a static ONNX operator gate before generation;
- a real `burn-onnx` `ModelGen` import into a temporary directory.

`generate` validates the voice metadata and license, then writes one WAV file
per cue and an
`audio-cues.manifest.json` file containing a stable `cueId -> assetPath` map.
Generation uses an external Piper-compatible CLI so this crate does not link or
embed Piper GPL code. Burn compatibility is not required for generation because
Piper, rather than Burn, executes the ONNX model. The stricter `validate` and
`doctor` commands keep the Burn ONNX compatibility check for diagnostic use.

## Configuration

```toml
voice_model = "./voices/fr_FR/example.onnx"
voice_config = "./voices/fr_FR/example.onnx.json"
output_dir = "../apps/pwa/assets/audio/cues"

[synthesizer]
command = "piper"
args = ["--model", "{voice_model}", "--config", "{voice_config}", "--output_file", "{output_file}"]
stdin_text = true

[[cues]]
id = "countdown_3"
text = "3"
filename = "countdown-3.wav"
```

Rules:

- `id` must match `[a-z][A-Za-z0-9_]*`; snake_case and camelCase are accepted.
- `text` must be non-empty after trim.
- `filename` must be relative and must not contain `..`.
- `voice_model` must point to an ONNX file.
- a `MODEL_CARD.md`, `MODEL_CARD` or `README.md` next to the voice must contain
  a visible license line.

The default synthesizer command is:

```bash
piper --model <voice_model> --config <voice_config> --output_file <output_file>
```

The cue text is sent on stdin. For the Open Home Foundation Python module style
CLI, use:

```toml
[synthesizer]
command = "python3"
args = ["-m", "piper", "-m", "{voice_model}", "-f", "{output_file}", "--", "{text}"]
stdin_text = false
```

References:

- Piper CLI: https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/CLI.md
- Piper voices and license notes:
  https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md

## Voice models

Do not commit large voice models by default. Keep local voices under
`tts-audio-generator/voices/`, which is ignored by Git, unless a model and its
license have been explicitly approved for versioning.

Expected local layout:

```text
tts-audio-generator/voices/fr_FR/
  voice.onnx
  voice.onnx.json
  MODEL_CARD.md
```

`MODEL_CARD.md` must include an explicit license line, for example
`License: CC-BY-4.0`.

Burn `0.21.0` is declared as the model framework dependency. `burn-onnx`
`0.21.0` is enabled by default through the `burn-onnx-validation` feature and is
used to run the Burn ONNX importer during voice validation.

Tests inject a deterministic fake synthesizer so they can run without a local
voice model when run with `--no-default-features`. Production `generate` calls
the configured Piper command and fails if it cannot produce a valid PCM WAV
file.

## French voice selection

The local French voice evaluation retained these three generation variants:

| Output variant | Piper model | Speaker | License |
| --- | --- | --- | --- |
| `siwis-medium` | `fr_FR/siwis/medium` | default | CC-BY 4.0 |
| `upmc-medium-jessica` | `fr_FR/upmc/medium` | `0` (`jessica`) | CC BY-SA 4.0 |
| `upmc-medium-pierre` | `fr_FR/upmc/medium` | `1` (`pierre`) | CC BY-SA 4.0 |

`gilles`, `mls` and `mls_1840` were rejected because their generated French
audio was not understandable. `tom/medium` produced good audio but was removed
because its model is distributed under AGPLv3.

The models, model cards and generated selection files remain local and ignored
by Git under `tts-audio-generator/voices/`.

## Generated French cue pack

The current local selection pack is stored under:

```text
tts-audio-generator/voices/_generated-cues/fr_FR/
  siwis-medium/
  upmc-medium-jessica/
  upmc-medium-pierre/
```

Each variant contains the same 31 cue IDs:

| Cue IDs | Spoken text |
| --- | --- |
| `exerciseStart` | `début de l'exercice` |
| `countdown3`, `countdown2`, `countdown1` | `trois`, `deux`, `un` |
| `restStart` | `phase de récupération` |
| `sessionComplete` | `exercice terminé` |
| `series1` to `series12` | ordinal series from `première série` to `douzième série` |
| `intervales1` | `premier intervalle d'entrainement` |
| `intervalles2` to `intervalles12` | ordinal training intervals from the second to the twelfth |

`intervales1` intentionally keeps the requested single-`l` cue ID. The other
training interval IDs use the `intervalles` spelling. This is part of the
current asset contract and should only be renamed together with its consumers.

The pack contains 93 WAV files in total: 31 cues for each of the three voice
variants. Files are PCM 16-bit, mono, 22050 Hz.

## Real Piper verification

When Piper and a licensed voice are available locally, first make a TOML config
that points to the real voice files and command:

```toml
voice_model = "/absolute/path/to/voice.onnx"
voice_config = "/absolute/path/to/voice.onnx.json"
model_card = "/absolute/path/to/MODEL_CARD.md"
output_dir = "../apps/pwa/assets/audio/cues"

[synthesizer]
command = "/absolute/path/to/piper"
args = ["--model", "{voice_model}", "--config", "{voice_config}", "--output_file", "{output_file}"]
stdin_text = true

[[cues]]
id = "work_start"
text = "C'est parti"
filename = "work-start.wav"
```

Then run:

```bash
cargo run --manifest-path tts-audio-generator/Cargo.toml -- doctor --config /absolute/path/to/cues.toml
cargo run --manifest-path tts-audio-generator/Cargo.toml -- generate --config /absolute/path/to/cues.toml
```

The ignored integration test can also synthesize one cue from environment
variables:

```bash
PIPER_COMMAND=piper \
PIPER_VOICE_MODEL=/absolute/path/to/voice.onnx \
PIPER_VOICE_CONFIG=/absolute/path/to/voice.onnx.json \
PIPER_MODEL_CARD=/absolute/path/to/MODEL_CARD.md \
cargo test --manifest-path tts-audio-generator/Cargo.toml --test real_piper_generation -- --ignored
```

`PIPER_MODEL_CARD` can be omitted if `MODEL_CARD.md` is stored next to the voice
model.
