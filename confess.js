import {
  loadModel,
  unloadModel,
  completion,
  textToSpeech,
  SMOLVLM2_500M_MULTIMODAL_Q8_0,
  MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
  TTS_MULTILINGUAL_SUPERTONIC3_Q8_0,
} from '@qvac/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const imagePath = process.argv[2];
if (!imagePath || !fs.existsSync(imagePath)) {
  console.error('Usage: node confess.js <path-to-image>');
  process.exit(1);
}

const progress = (label) => (p) =>
  process.stderr.write(`\r  ${label} ${p.percentage.toFixed(0)}%`);

function writeWav(filePath, samples, sampleRate) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, samples[i])), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

async function main() {
  console.log('\n  THE OBJECT CONFESSIONAL\n');

  console.log('-> Loading vision model...');
  const visionId = await loadModel({
    modelSrc: SMOLVLM2_500M_MULTIMODAL_Q8_0,
    modelType: 'llm',
    modelConfig: {
      projectionModelSrc: MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
      ctx_size: 2048,
    },
    onProgress: progress('vision'),
  });
  process.stderr.write('\n');

  const prompt =
    'Look at this image carefully. First, in one short phrase, name the main object. ' +
    'Then, as that object, write a dramatic first-person confession (3-5 sentences) ' +
    'about what it has witnessed, resented, or secretly dreamed of. ' +
    'Be specific, dramatic, and slightly petty. Output format exactly:\n' +
    'OBJECT: <name>\n' +
    'CONFESSION: <text>';

  console.log('-> The object is thinking...\n--- CONFESSION ---\n');

  const run = completion({
    modelId: visionId,
    history: [
      { role: 'user', content: prompt, attachments: [{ path: imagePath }] },
    ],
    stream: true,
  });

  let raw = '';
  for await (const token of run.tokenStream) {
    process.stdout.write(token);
    raw += token;
  }
  console.log('\n------------------\n');

  await unloadModel({ modelId: visionId });

  const match = raw.match(/CONFESSION:\s*([\s\S]+)/i);
  const confession = (match ? match[1] : raw).trim();

  if (!confession) {
    console.error('No confession generated.');
    process.exit(1);
  }

  console.log('-> Loading TTS voice...');
  const ttsId = await loadModel({
    modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q8_0.src,
    modelType: 'tts',
    modelConfig: {
      ttsEngine: 'supertonic',
      language: 'en',
    },
    onProgress: progress('tts'),
  });
  process.stderr.write('\n');

  console.log('-> Generating audio...');
  const audio = await textToSpeech({
    modelId: ttsId,
    text: confession,
    inputType: 'text',
    stream: false,
  });

  fs.mkdirSync('./output', { recursive: true });
  const outPath = path.resolve('./output/confession.wav');

  const samples = audio?.buffer;
  if (Array.isArray(samples) && samples.length > 0) {
    writeWav(outPath, samples, 44100);
  } else if (Buffer.isBuffer(samples)) {
    fs.writeFileSync(outPath, samples);
  } else {
    console.error('Unexpected TTS output shape:', audio);
    process.exit(1);
  }

  await unloadModel({ modelId: ttsId });

  console.log('Playing confession...\n');
  const player = process.platform === 'darwin' ? 'afplay' : 'aplay';
  try {
    execSync(`${player} "${outPath}"`, { stdio: 'inherit' });
  } catch {
    console.log(`(Auto-play failed. Open manually: ${outPath})`);
  }

  console.log('\nDone.\n');
}

main().catch((e) => {
  console.error('\nERROR:', e?.message ?? e);
  process.exit(1);
});
