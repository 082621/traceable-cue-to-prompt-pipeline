import { createHash } from 'node:crypto';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validateModelOutput } from '../shared/outputValidator.js';
import { createGenerationOrchestrator } from '../server/orchestrator.js';

const round = (value) => Number(value.toFixed(4));

export function hashMessage(message) {
  return createHash('sha256').update(message).digest('hex').slice(0, 16);
}

export function classifyProviderError(error) {
  if (error?.code) return String(error.code);
  if (error?.status) return `http-${error.status}`;
  return error?.name || 'provider-error';
}

function candidateMetrics(output, validation, latencyMs, errorClass = null) {
  return {
    producedOutput: Boolean(output),
    accepted: validation?.accepted ?? false,
    cueIdCoverage: validation?.cueIdCoverage ?? 0,
    cueTextCoverage: validation?.cueTextCoverage ?? 0,
    unknownCueIdCount: validation?.unknownCueIds?.length ?? 0,
    missingCueIdCount: validation?.missingCueIds?.length ?? 0,
    missingCueTextCount: validation?.missingCueTextIds?.length ?? 0,
    safetyFlagCount: validation?.safetyFlags?.length ?? 0,
    messageChars: output?.message.length ?? 0,
    messageHash: output ? hashMessage(output.message) : null,
    latencyMs: round(latencyMs),
    errorClass,
  };
}

export async function evaluateAblationRun({ testCase, repeat, generator }) {
  const plan = buildPromptPlan(testCase.request);

  const deterministicStarted = performance.now();
  const deterministicOutput = generateDeterministicPrompt(plan);
  const deterministicValidation = validateModelOutput(plan, deterministicOutput);
  const deterministic = candidateMetrics(
    deterministicOutput,
    deterministicValidation,
    performance.now() - deterministicStarted,
  );

  let rawOutput = null;
  let rawError = null;
  const modelStarted = performance.now();
  try {
    rawOutput = await generator.generate(plan);
  } catch (error) {
    rawError = error;
  }
  const modelLatencyMs = performance.now() - modelStarted;
  const rawValidation = rawOutput ? validateModelOutput(plan, rawOutput) : null;
  const modelOnly = candidateMetrics(
    rawOutput,
    rawValidation,
    modelLatencyMs,
    rawError ? classifyProviderError(rawError) : null,
  );

  let replayedInitialAttempt = false;
  let additionalProviderCalls = 0;
  const replayGenerator = {
    model: generator.model,
    configured: generator.configured,
    async generate(receivedPlan, repairReport) {
      if (!replayedInitialAttempt) {
        replayedInitialAttempt = true;
        if (rawError) throw rawError;
        return rawOutput;
      }
      additionalProviderCalls += 1;
      return generator.generate(receivedPlan, repairReport);
    },
  };

  const recoveryStarted = performance.now();
  const fullResult = await createGenerationOrchestrator({ generator: replayGenerator })(
    testCase.request,
    `ablation-${testCase.id}-r${repeat}`,
  );
  const fullLatencyMs = modelLatencyMs + (performance.now() - recoveryStarted);
  const fullPipeline = {
    producedOutput: true,
    accepted: fullResult.validation.accepted,
    cueIdCoverage: fullResult.validation.cueIdCoverage,
    cueTextCoverage: fullResult.validation.cueTextCoverage,
    unknownCueIdCount: fullResult.validation.unknownCueIds.length,
    missingCueIdCount: fullResult.validation.missingCueIds.length,
    missingCueTextCount: fullResult.validation.missingCueTextIds.length,
    safetyFlagCount: fullResult.validation.safetyFlags.length,
    messageChars: fullResult.message.length,
    messageHash: hashMessage(fullResult.message),
    latencyMs: round(fullLatencyMs),
    errorClass: null,
    method: fullResult.metadata.method,
    fallbackReason: fullResult.metadata.fallbackReason,
    attempts: fullResult.metadata.attempts,
    usedFallback: fullResult.metadata.usedFallback,
  };

  return {
    runKey: `${testCase.id}-R${repeat}`,
    caseId: testCase.id,
    repeat,
    factors: testCase.factors,
    planDigest: fullResult.metadata.planDigest,
    providerCalls: 1 + additionalProviderCalls,
    conditions: {
      deterministic,
      modelOnly,
      fullPipeline,
    },
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function summariseCondition(rows, conditionName) {
  const values = rows.map((row) => row.conditions[conditionName]);
  const latencies = values.map((value) => value.latencyMs);
  const caseHashes = new Map();
  rows.forEach((row) => {
    if (!caseHashes.has(row.caseId)) caseHashes.set(row.caseId, []);
    if (row.conditions[conditionName].messageHash) {
      caseHashes.get(row.caseId).push(row.conditions[conditionName].messageHash);
    }
  });
  const consistentCases = [...caseHashes.values()].filter(
    (hashes) => hashes.length > 0 && new Set(hashes).size === 1,
  ).length;

  return {
    runCount: values.length,
    outputCount: values.filter((value) => value.producedOutput).length,
    acceptedCount: values.filter((value) => value.accepted).length,
    acceptanceRate: round(values.filter((value) => value.accepted).length / values.length),
    rejectedUniqueCaseCount: new Set(
      rows.filter((row) => !row.conditions[conditionName].accepted).map((row) => row.caseId),
    ).size,
    meanCueIdCoverage: round(values.reduce((sum, value) => sum + value.cueIdCoverage, 0) / values.length),
    meanCueTextCoverage: round(values.reduce((sum, value) => sum + value.cueTextCoverage, 0) / values.length),
    meanMessageChars: round(values.reduce((sum, value) => sum + value.messageChars, 0) / values.length),
    runsWithMissingCueText: values.filter((value) => value.missingCueTextCount > 0).length,
    runsWithUnknownCueIds: values.filter((value) => value.unknownCueIdCount > 0).length,
    runsWithSafetyFlags: values.filter((value) => value.safetyFlagCount > 0).length,
    runsWithOtherConstraintFailure: values.filter(
      (value) => !value.accepted
        && value.missingCueIdCount === 0
        && value.missingCueTextCount === 0
        && value.unknownCueIdCount === 0
        && value.safetyFlagCount === 0,
    ).length,
    consistentOutputCaseCount: consistentCases,
    consistentOutputCaseRate: round(consistentCases / caseHashes.size),
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      mean: round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
    },
  };
}

export function summariseAblation(rows) {
  const fullValues = rows.map((row) => row.conditions.fullPipeline);
  return {
    runCount: rows.length,
    uniqueCaseCount: new Set(rows.map((row) => row.caseId)).size,
    totalProviderCalls: rows.reduce((sum, row) => sum + row.providerCalls, 0),
    conditions: {
      deterministic: summariseCondition(rows, 'deterministic'),
      modelOnly: summariseCondition(rows, 'modelOnly'),
      fullPipeline: {
        ...summariseCondition(rows, 'fullPipeline'),
        firstPassCount: fullValues.filter((value) => value.method === 'model').length,
        repairedCount: fullValues.filter((value) => value.method === 'model-repair').length,
        fallbackCount: fullValues.filter((value) => value.usedFallback).length,
      },
    },
    pairedRecovery: {
      modelOnlyRejectedButFullAccepted: rows.filter(
        (row) => !row.conditions.modelOnly.accepted && row.conditions.fullPipeline.accepted,
      ).length,
    },
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createRandomisedTasks(cases, repeats, seed) {
  const tasks = cases.flatMap((testCase) =>
    Array.from({ length: repeats }, (_, index) => ({ testCase, repeat: index + 1 }))
  );
  const random = seededRandom(seed);
  for (let index = tasks.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [tasks[index], tasks[swapIndex]] = [tasks[swapIndex], tasks[index]];
  }
  return tasks;
}
