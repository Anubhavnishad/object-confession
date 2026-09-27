> Built for the QVAC hackathon. Point a photo at any object — it confesses its secrets, spoken aloud, fully on-device.
# The Object Confessional

Point a photo at any object — a mug, a chair, a plant — and it delivers a
dramatic, first-person confession of everything it has witnessed, resented,
and secretly dreamed of, read aloud in a solemn voice.

**100% on-device. No cloud AI. No API keys. Your photos never leave your laptop.**

---

## How it works

1. Upload any photo of an object via the local web UI.
2. A vision LLM (SmolVLM2 500M) looks at the image and writes a confession
   in the object's voice.
3. A text-to-speech engine (Supertonic 3) reads the confession aloud.

Everything runs on your machine through @qvac/sdk. Nothing is sent to any
server.

---

## QVAC functions used

| Function | Purpose |
|---|---|
| loadModel | Loads the vision LLM and the TTS voice |
| completion | Identifies the object and generates the confession text |
| textToSpeech | Speaks the confession aloud |

All inference runs on-device.

---

## Requirements

- Node.js >= 22.17
- macOS 14+ (Apple Silicon), Linux with Vulkan 1.4+, or Windows 10+ with Vulkan 1.4+
- ~1 GB free disk space for the one-time model download (cached after first run)

---

## Install

    git clone https://github.com/bigyan-codes/object-confessional.git
    cd object-confessional
    npm install

---

## Run

    node server.js

Then open http://localhost:3000 in your browser.

1. Drag any object photo onto the dashed box (or click to choose a file).
2. Click Confess.
3. The confession text appears and the audio plays automatically.

The first run downloads ~750 MB of models (vision + TTS). Subsequent runs
start instantly because the models are cached locally.

---

## SDK version

@qvac/sdk >= 0.19.0

---

## Why I built it

I wanted to know what my coffee mug really thinks of me.

---

## License

MIT — see LICENSE.
