import dotenv from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createGenerationOrchestrator } from '../server/orchestrator.js';
import { createOpenAIGenerator } from '../server/openaiGenerator.js';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validateModelOutput } from '../shared/outputValidator.js';
import { edgeCases } from './edgeCases.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
};
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value) => Number(value.toFixed(2));

const generator = createOpenAIGenerator();
if (!generator.configured) throw new Error('OPENAI_API_KEY is required for the live edge benchmark');
const orchestrate = createGenerationOrchestrator({ generator });
const packageMetadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const openAIMetadata = JSON.parse(await readFile(new URL('../node_modules/openai/package.json', import.meta.url), 'utf8'));

const rows = [];
for (const [index, testCase] of edgeCases.entries()) {
  const plan = buildPromptPlan(testCase.request);
  const baseline = generateDeterministicPrompt(plan);
  const baselineValidation = validateModelOutput(plan, baseline);
  const startedAt = performance.now();
  const pipeline = await orchestrate(testCase.request, `edge-benchmark-${testCase.id}`);
  const wallClockMs = performance.now() - startedAt;

  rows.push({
    caseId: testCase.id,
    category: testCase.category,
    baseline: {
      message: baseline.message,
      validation: baselineValidation,
      messageChars: baseline.message.length,
    },
    pipeline: {
      message: pipeline.message,
      trace: pipeline.trace,
      validation: pipeline.validation,
      metadata: pipeline.metadata,
      messageChars: pipeline.message.length,
      wallClockMs: round(wallClockMs),
    },
  });
  console.info(`[${index + 1}/${edgeCases.length}] ${testCase.id}: ${pipeline.metadata.method}`);
}

const pipelineLatencies = rows.map((row) => row.pipeline.wallClockMs);
const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    experiment: 'live-20-case-edge-benchmark',
    projectVersion: packageMetadata.version,
    model: generator.model,
    modelSettings: generator.settings,
    schemaVersion: '2.0',
    nodeVersion: process.version,
    openaiSdkVersion: openAIMetadata.version,
    syntheticDataOnly: true,
    generatedTextPersisted: true,
  },
  summary: {
    caseCount: rows.length,
    baselineAcceptedCount: rows.filter((row) => row.baseline.validation.accepted).length,
    pipelineAcceptedCount: rows.filter((row) => row.pipeline.validation.accepted).length,
    firstPassCount: rows.filter((row) => row.pipeline.metadata.method === 'model').length,
    repairedCount: rows.filter((row) => row.pipeline.metadata.method === 'model-repair').length,
    fallbackCount: rows.filter((row) => row.pipeline.metadata.usedFallback).length,
    providerCalls: rows.reduce((sum, row) => sum + row.pipeline.metadata.attempts, 0),
    baselineMeanMessageChars: round(mean(rows.map((row) => row.baseline.messageChars))),
    pipelineMeanMessageChars: round(mean(rows.map((row) => row.pipeline.messageChars))),
    latencyMs: {
      p50: percentile(pipelineLatencies, 50),
      p95: percentile(pipelineLatencies, 95),
      mean: round(mean(pipelineLatencies)),
    },
  },
  rows,
};

await mkdir('benchmark/results', { recursive: true });
const target = 'benchmark/results/edge-benchmark-live-latest.json';
await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.info(JSON.stringify(report.summary, null, 2));
console.info(`Saved ${target}; all messages are synthetic.`);
