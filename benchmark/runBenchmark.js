import dotenv from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createGenerationOrchestrator } from '../server/orchestrator.js';
import { createOpenAIGenerator } from '../server/openaiGenerator.js';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validateModelOutput } from '../shared/outputValidator.js';
import { benchmarkCases } from './cases.js';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const live = process.argv.includes('--live');
const faultModes = ['clean', 'missing-text', 'missing-id', 'unknown-id', 'provider-error', 'persistent-invalid'];
const openAIPackage = JSON.parse(
  await readFile(new URL('../node_modules/openai/package.json', import.meta.url), 'utf8'),
);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function offlineGenerator(caseIndex) {
  const mode = faultModes[caseIndex % faultModes.length];
  return {
    model: `fault-injection/${mode}`,
    configured: false,
    async generate(plan, repairReport) {
      if (mode === 'provider-error') throw new Error('Injected provider failure');
      const output = generateDeterministicPrompt(plan);
      if (mode === 'clean' || (repairReport && mode !== 'persistent-invalid')) return output;
      if (mode === 'missing-text' || mode === 'persistent-invalid') {
        output.message = output.message.replace(plan.cueUnits[0].text, '【线索被故障注入器删除】');
      }
      if (mode === 'missing-id') output.usedCueIds = output.usedCueIds.slice(1);
      if (mode === 'unknown-id') output.usedCueIds.push('invented.cue.99');
      return output;
    },
  };
}

async function run() {
  const rows = [];
  const sharedLiveGenerator = live ? createOpenAIGenerator() : null;
  if (live && !sharedLiveGenerator.configured) throw new Error('OPENAI_API_KEY is required for --live');

  for (const [index, testCase] of benchmarkCases.entries()) {
    const baselinePlan = buildPromptPlan(testCase.request);
    const baselineReport = validateModelOutput(baselinePlan, generateDeterministicPrompt(baselinePlan));
    const generator = sharedLiveGenerator ?? offlineGenerator(index);
    const startedAt = performance.now();
    const result = await createGenerationOrchestrator({ generator })(testCase.request, `benchmark-${testCase.id}`);
    const wallClockMs = performance.now() - startedAt;

    rows.push({
      caseId: testCase.id,
      mode: generator.model,
      baselineCueTextCoverage: baselineReport.cueTextCoverage,
      resultCueIdCoverage: result.validation.cueIdCoverage,
      resultCueTextCoverage: result.validation.cueTextCoverage,
      accepted: result.validation.accepted,
      method: result.metadata.method,
      fallbackReason: result.metadata.fallbackReason,
      attempts: result.metadata.attempts,
      usedFallback: result.metadata.usedFallback,
      wallClockMs: Number(wallClockMs.toFixed(2)),
    });
  }

  const latency = rows.map((row) => row.wallClockMs);
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: live ? 'live-openai' : 'offline-fault-injection',
    model: live ? sharedLiveGenerator.model : 'fault-injection-generators',
    modelSettings: live ? sharedLiveGenerator.settings : null,
    schemaVersion: '2.0',
    nodeVersion: process.version,
    openaiSdkVersion: openAIPackage.version,
    syntheticDataOnly: true,
    generatedTextPersisted: false,
    caseCount: rows.length,
    acceptedCount: rows.filter((row) => row.accepted).length,
    firstPassCount: rows.filter((row) => row.method === 'model').length,
    repairedCount: rows.filter((row) => row.method === 'model-repair').length,
    fallbackCount: rows.filter((row) => row.usedFallback).length,
    meanCueTextCoverage: rows.reduce((sum, row) => sum + row.resultCueTextCoverage, 0) / rows.length,
    latencyMs: {
      p50: percentile(latency, 50),
      p95: percentile(latency, 95),
    },
  };
  const report = { summary, rows };
  await mkdir('benchmark/results', { recursive: true });
  const target = live ? 'benchmark/results/live-latest.json' : 'benchmark/results/offline-latest.json';
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.table(rows);
  console.info(summary);
  console.info(`Saved ${target}`);
}

await run();
