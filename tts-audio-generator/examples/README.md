# TTS generator examples

`cues.toml` is a template. It intentionally references a local voice path under
`tts-audio-generator/voices/`, which is ignored by Git.

Use this layout for local voice validation:

```text
tts-audio-generator/voices/fr_FR/
  voice.onnx
  voice.onnx.json
  MODEL_CARD.md
```

The `MODEL_CARD.md` file must include a visible license line, for example:

```text
License: CC-BY-4.0
```

If Piper is not named `piper` in your `PATH`, add a `[synthesizer]` block to the
config with the absolute executable path.
