import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { validateModelOutput } from '../shared/outputValidator.js';
import { edgeCases } from './edgeCases.js';

const resultsDirectory = new URL('./results/', import.meta.url);
const ratingSheetUrl = new URL('naturalness-rating-sheet-latest.md', resultsDirectory);
const conditionKeyUrl = new URL('naturalness-condition-key-latest.json', resultsDirectory);
const outputUrl = new URL('edge-benchmark-latest.json', resultsDirectory);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const round = (value) => Number(value.toFixed(2));

function parseRatingSheet(markdown) {
  return Object.fromEntries(
    markdown
      .split(/^## /mu)
      .slice(1)
      .map((block) => {
        const heading = block.match(/^(edge-\d+) — ([^\n]+)/u);
        if (!heading) throw new Error('Rating sheet contains an invalid case heading');
        const messages = Object.fromEntries(
          [...block.matchAll(/^### Message ([AB])\n\n([\s\S]*?)\n\nNaturalness:/gmu)]
            .map((match) => [match[1], match[2].trim()]),
        );
        if (!messages.A || !messages.B) throw new Error(`Missing A/B message for ${heading[1]}`);
        return [heading[1], { category: heading[2], messages }];
      }),
  );
}

function candidateFor(plan, message) {
  return {
    message,
    usedCueIds: [...plan.requiredCueIds],
    appliedSupportNeedIds: [...plan.requiredSupportNeedIds],
    appliedResponseStyleId: plan.responseStyle.id,
  };
}

const [ratingSheetText, conditionKeyText] = await Promise.all([
  readFile(ratingSheetUrl, 'utf8'),
  readFile(conditionKeyUrl, 'utf8'),
]);
const ratingSheet = parseRatingSheet(ratingSheetText);
const conditionKey = JSON.parse(conditionKeyText);
const keyByCase = Object.fromEntries(conditionKey.ratingKey.map((entry) => [entry.id, entry]));

const rows = edgeCases.map((testCase) => {
  const sheetCase = ratingSheet[testCase.id];
  const key = keyByCase[testCase.id];
  if (!sheetCase || !key) throw new Error(`Missing preserved evidence for ${testCase.id}`);
  if (sheetCase.category !== testCase.category) {
    throw new Error(`Category mismatch for ${testCase.id}`);
  }

  const baselineLabel = key.A === 'baseline' ? 'A' : 'B';
  const pipelineLabel = key.A === 'pipeline' ? 'A' : 'B';
  const plan = buildPromptPlan(testCase.request);
  const baselineMessage = sheetCase.messages[baselineLabel];
  const pipelineMessage = sheetCase.messages[pipelineLabel];
  const deterministicBaseline = generateDeterministicPrompt(plan);
  if (deterministicBaseline.message !== baselineMessage) {
    throw new Error(`Recovered request does not reproduce the preserved baseline: ${testCase.id}`);
  }
  const baselineValidation = validateModelOutput(plan, deterministicBaseline);
  const pipelineValidation = validateModelOutput(plan, candidateFor(plan, pipelineMessage));

  if (!baselineValidation.accepted || !pipelineValidation.accepted) {
    throw new Error(`Preserved message no longer satisfies the current contract: ${testCase.id}`);
  }

  let terminalMethodEvidence = 'model';
  if (testCase.id === 'edge-16') terminalMethodEvidence = 'deterministic-fallback';
  else if (testCase.category === 'sensitive-safety') terminalMethodEvidence = 'model-or-model-repair';

  return {
    caseId: testCase.id,
    category: testCase.category,
    labels: { baseline: baselineLabel, pipeline: pipelineLabel },
    terminalMethodEvidence,
    baseline: {
      accepted: baselineValidation.accepted,
      cueIdCoverage: baselineValidation.cueIdCoverage,
      cueTextCoverage: baselineValidation.cueTextCoverage,
      supportNeedPreserved: baselineValidation.missingSupportNeedIds.length === 0,
      messageChars: baselineMessage.length,
      messageSha256: sha256(baselineMessage),
    },
    pipeline: {
      accepted: pipelineValidation.accepted,
      traceSource: 'canonical-plan-reconstruction',
      cueIdCoverage: pipelineValidation.cueIdCoverage,
      cueTextCoverage: pipelineValidation.cueTextCoverage,
      supportNeedPreserved: pipelineValidation.missingSupportNeedIds.length === 0,
      messageChars: pipelineMessage.length,
      messageSha256: sha256(pipelineMessage),
    },
  };
});

const categoryMethods = [
  { category: 'normal', cases: 4, firstPassModel: 4, repair: 0, fallback: 0, accepted: 4 },
  { category: 'schema-minimal', cases: 4, firstPassModel: 4, repair: 0, fallback: 0, accepted: 4 },
  { category: 'multi-concern', cases: 4, firstPassModel: 4, repair: 0, fallback: 0, accepted: 4 },
  { category: 'contradictory', cases: 4, firstPassModel: 3, repair: 0, fallback: 1, accepted: 4 },
  { category: 'sensitive-safety', cases: 4, firstPassModel: 3, repair: 1, fallback: 0, accepted: 4 },
];
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const report = {
  metadata: {
    evidenceStatus: 'reconstructed-from-preserved-artifacts',
    reconstructionToolVersion: '1.0',
    sourceConditionKeyGeneratedAt: conditionKey.generatedAt,
    recordedRunDate: '2026-08-09',
    model: 'gpt-5.4-mini',
    schemaVersion: '2.0',
    syntheticDataOnly: true,
    generatedTextLocation: 'naturalness-rating-sheet-latest.md',
    sources: {
      ratingSheet: { filename: 'naturalness-rating-sheet-latest.md', sha256: sha256(ratingSheetText) },
      conditionKey: { filename: 'naturalness-condition-key-latest.json', sha256: sha256(conditionKeyText) },
      dissertation: 'Appendix H.4 and Appendix A.4 of the submitted Style-Polished report',
    },
    validationBasis: 'Baseline messages are byte-reproduced by the recovered deterministic generator. Pipeline message, exact-text, support, style, and safety invariants are rechecked against recovered requests. Pipeline trace IDs use the canonical recovered plan because the original per-case trace telemetry is unavailable.',
    limitation: 'The original per-case machine telemetry was absent from the recovered source archive. Aggregate cue-ID, method, provider-call, and latency values are transcribed from the submitted report. The preserved blind materials identify edge-16 as fallback, but do not identify which sensitive/safety case used repair.',
  },
  summary: {
    caseCount: rows.length,
    baseline: {
      acceptedCount: rows.filter((row) => row.baseline.accepted).length,
      meanCueIdCoverage: mean(rows.map((row) => row.baseline.cueIdCoverage)),
      meanCueTextCoverage: mean(rows.map((row) => row.baseline.cueTextCoverage)),
      supportNeedPreservedCount: rows.filter((row) => row.baseline.supportNeedPreserved).length,
      meanMessageChars: round(mean(rows.map((row) => row.baseline.messageChars))),
    },
    pipeline: {
      acceptedCount: rows.filter((row) => row.pipeline.accepted).length,
      firstPassCount: 18,
      repairedCount: 1,
      fallbackCount: 1,
      providerCalls: 22,
      meanCueIdCoverage: mean(rows.map((row) => row.pipeline.cueIdCoverage)),
      meanCueTextCoverage: mean(rows.map((row) => row.pipeline.cueTextCoverage)),
      supportNeedPreservedCount: rows.filter((row) => row.pipeline.supportNeedPreserved).length,
      meanMessageChars: round(mean(rows.map((row) => row.pipeline.messageChars))),
      latencyMs: { p50: 1788.69, p95: 4296.54, mean: 2284.58 },
    },
    categoryMethods,
  },
  rows,
};

await mkdir(resultsDirectory, { recursive: true });
await writeFile(outputUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.info(`Validated and reconstructed ${rows.length} edge cases at ${outputUrl.pathname}`);
