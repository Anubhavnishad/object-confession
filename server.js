import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadModel,
  completion,
  textToSpeech,
  SMOLVLM2_500M_MULTIMODAL_Q8_0,
  MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
  TTS_MULTILINGUAL_SUPERTONIC3_Q8_0
} from '@qvac/sdk';

const PORT = 3000;
const uploadDir = path.resolve('uploads');
const audioDir = path.resolve('output');

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

const app = express();
const upload = multer({ dest: uploadDir });

app.use(express.static('public'));
app.use('/audio', express.static(audioDir));

let visionModel;
let speechModel;

const confessionPrompt = `
Look at the uploaded image and identify the main everyday object.

Write a short humorous confession from the object's own point of view.

Format:
OBJECT: <object name>
CONFESSION: <2 or 3 sentences>

Rules:
- Maximum 60 words.
- Mention at least one visible physical detail.
- Mention something humans do with or around the object.
- Make the voice personal, petty, and slightly annoyed.
- Keep it grounded in ordinary life.
- Do not discuss the universe, destiny, civilizations, politics, or philosophy.
`;

function createWav(file, samples, rate) {
  const buffer = Buffer.alloc(44 + samples.length * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-32768, Math.min(32767, samples[i]));
    buffer.writeInt16LE(value, 44 + i * 2);
  }

  fs.writeFileSync(file, buffer);
}

async function loadLocalModels() {
  console.log('Loading local QVAC vision model...');

  visionModel = await loadModel({
    modelSrc: SMOLVLM2_500M_MULTIMODAL_Q8_0,
    modelType: 'llm',
    modelConfig: {
      projectionModelSrc: MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
      ctx_size: 2048
    }
  });

  console.log('Loading local QVAC speech model...');

  speechModel = await loadModel({
    modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q8_0.src,
    modelType: 'tts',
    modelConfig: {
      ttsEngine: 'supertonic',
      language: 'en'
    }
  });

  console.log('Local QVAC models are ready.');
}

async function generateConfession(imagePath) {
  const result = completion({
    modelId: visionModel,
    history: [
      {
        role: 'user',
        content: confessionPrompt,
        attachments: [{ path: imagePath }]
      }
    ],
    stream: true,
    temp: 0.45,
    top_p: 0.9,
    predict: 120
  });

  let response = '';

  for await (const token of result.tokenStream) {
    response += token;
  }

  const confessionMatch = response.match(
    /CONFESSION:\s*([\s\S]*)/i
  );

  const confession = (
    confessionMatch ? confessionMatch[1] : response
  ).trim();

  if (!confession) {
    throw new Error('QVAC did not return a confession.');
  }

  return confession;
}

async function createSpeech(text) {
  const result = await textToSpeech({
    modelId: speechModel,
    text,
    inputType: 'text',
    stream: false
  });

  const samples = await result.buffer;
  const sampleRate = (await result.sampleRate) || 44100;

  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('QVAC did not return audio samples.');
  }

  const filename = `object-${Date.now()}.wav`;
  const filepath = path.join(audioDir, filename);

  createWav(filepath, samples, sampleRate);

  return `/audio/${filename}`;
}

app.post('/api/confess', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Please upload an image.'
    });
  }

  const imagePath = req.file.path;

  try {
    console.log('Analyzing uploaded object with QVAC...');

    const confession = await generateConfession(imagePath);

    console.log('Creating local speech with QVAC...');

    const audioUrl = await createSpeech(confession);

    res.json({
      confession,
      audioUrl
    });
  } catch (error) {
    console.error('Object confession failed:', error);

    res.status(500).json({
      error: error?.message || 'Something went wrong.'
    });
  } finally {
    fs.rm(imagePath, { force: true }, () => {});
  }
});

async function start() {
  try {
    await loadLocalModels();

    app.listen(PORT, () => {
      console.log(`\nObject Confessional is running at http://localhost:${PORT}\n`);
    });
  } catch (error) {
    console.error('Unable to start application:', error);
    process.exit(1);
  }
}

start();