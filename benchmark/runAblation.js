import dotenv from 'dotenv';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createOpenAIGenerator } from '../server/openaiGenerator.js';
import { benchmarkCases } from './cases.js';
import {
  createRandomisedTasks,
  evaluateAblationRun,
  summariseAblation,
} from './ablationCore.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

function integerArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number.parseInt(process.argv[index + 1], 10);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJsonAtomic(path, value) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}

const repeats = integerArgument('--repeats', 3);
const seed = integerArgument('--seed', 20260805);
const limit = Math.min(integerArgument('--limit', benchmarkCases.length), benchmarkCases.length);
const selectedCases = benchmarkCases.slice(0, limit);
const generator = createOpenAIGenerator();
if (!generator.configured) throw new Error('OPENAI_API_KEY is required for the live ablation benchmark');

const packageMetadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const openAIMetadata = JSON.parse(await readFile(new URL('../node_modules/openai/package.json', import.meta.url), 'utf8'));
const checkpointPath = `benchmark/results/ablation-checkpoint-${selectedCases.length}x${repeats}-s${seed}.json`;
const resultPath = 'benchmark/results/ablation-live-latest.json';
const configuration = {
  schemaVersion: '2.0',
  model: generator.model,
  modelSettings: generator.settings,
  repeats,
  seed,
  caseIds: selectedCases.map((testCase) => testCase.id),
};

await mkdir('benchmark/results', { recursive: true });
const checkpoint = await readJson(checkpointPath);
if (checkpoint && JSON.stringify(checkpoint.configuration) !== JSON.stringify(configuration)) {
  throw new Error('Existing ablation checkpoint has a different configuration; move or delete it before starting');
}

const rows = checkpoint?.rows ?? [];
const completed = new Set(rows.map((row) => row.runKey));
const tasks = createRandomisedTasks(selectedCases, repeats, seed);

console.info(`Ablation: ${selectedCases.length} cases × ${repeats} repeats = ${tasks.length} paired runs`);
console.info(`Model: ${generator.model}; resuming at ${completed.size}/${tasks.length}`);

for (const [index, task] of tasks.entries()) {
  const runKey = `${task.testCase.id}-R${task.repeat}`;
  if (completed.has(runKey)) continue;

  const row = await evaluateAblationRun({ ...task, generator });
  rows.push(row);
  completed.add(runKey);
  await writeJsonAtomic(checkpointPath, { configuration, rows });

  const raw = row.conditions.modelOnly;
  const full = row.conditions.fullPipeline;
  console.info(
    `[${index + 1}/${tasks.length}] ${runKey} raw=${raw.accepted ? 'accepted' : 'rejected'} `
      + `full=${full.method} calls=${row.providerCalls} latency=${full.latencyMs}ms`,
  );
}

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    experiment: 'paired-three-condition-ablation',
    projectVersion: packageMetadata.version,
    model: generator.model,
    modelSettings: generator.settings,
    schemaVersion: '2.0',
    nodeVersion: process.version,
    openaiSdkVersion: openAIMetadata.version,
    caseCount: selectedCases.length,
    repeats,
    randomisationSeed: seed,
    syntheticDataOnly: true,
    generatedTextPersisted: false,
    conditions: [
      'deterministic-v1',
      'structured-model-without-independent-recovery',
      'validated-repair-fallback-pipeline',
    ],
  },
  summary: summariseAblation(rows),
  rows: [...rows].sort((a, b) => a.runKey.localeCompare(b.runKey)),
};

await writeJsonAtomic(resultPath, report);
await unlink(checkpointPath).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
console.info(JSON.stringify(report.summary, null, 2));
console.info(`Saved ${resultPath}; generated messages were not persisted.`);
