import { modelRegistryList } from '@qvac/sdk';

const models = await modelRegistryList();
for (const m of models) {
  console.log(`${m.engine.padEnd(20)} ${m.quantization ?? '-'.padEnd(6)} ${m.name}`);
}
