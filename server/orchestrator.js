import { createHash, randomUUID } from 'node:crypto';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validateModelOutput } from '../shared/outputValidator.js';
import { GenerationResponseSchema } from '../shared/contracts.js';

function digestPlan(plan) {
  const { sessionId: _sessionId, ...semanticPlan } = plan;
  return createHash('sha256').update(JSON.stringify(semanticPlan)).digest('hex').slice(0, 16);
}

function publicValidation(report) {
  const { schemaIssues: _schemaIssues, ...publicReport } = report;
  return publicReport;
}

function isNonRetryableProviderError(error) {
  return ['missing_api_key', 'insufficient_quota', 'credit_balance_exhausted', 'invalid_api_key', 'model_not_found']
    .includes(error?.code)
    || [400, 401, 403, 404].includes(error?.status);
}

export function createGenerationOrchestrator({ generator, clock = () => Date.now() }) {
  if (!generator?.generate) throw new Error('A generator with generate(plan) is required');

  return async function generateValidatedPrompt(rawRequest, requestId = randomUUID()) {
    const startedAt = clock();
    const plan = buildPromptPlan(rawRequest);
    let attempts = 0;
    let lastReport = null;
    let fallbackReason = 'validation-failed';

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      attempts = attempt;
      try {
        const candidate = await generator.generate(plan, attempt === 2 ? lastReport : null);
        const validation = validateModelOutput(plan, candidate);
        lastReport = validation;
        fallbackReason = 'validation-failed';
        if (validation.accepted) {
          return GenerationResponseSchema.parse({
            message: candidate.message,
            trace: {
              usedCueIds: candidate.usedCueIds,
              appliedSupportNeedIds: candidate.appliedSupportNeedIds,
              appliedResponseStyleId: candidate.appliedResponseStyleId,
            },
            validation: publicValidation(validation),
            metadata: {
              requestId,
              planDigest: digestPlan(plan),
              method: attempt === 1 ? 'model' : 'model-repair',
              fallbackReason: 'none',
              attempts,
              usedFallback: false,
              latencyMs: Math.max(0, clock() - startedAt),
              model: generator.model,
            },
          });
        }
      } catch (error) {
        fallbackReason = 'provider-unavailable';
        lastReport = {
          accepted: false,
          safetyFlags: ['provider-or-parser-error'],
        };
        if (isNonRetryableProviderError(error)) break;
      }
    }

    const fallback = generateDeterministicPrompt(plan);
    const validation = validateModelOutput(plan, fallback);
    if (!validation.accepted) throw new Error('Invariant violation: deterministic fallback failed validation');

    return GenerationResponseSchema.parse({
      message: fallback.message,
      trace: {
        usedCueIds: fallback.usedCueIds,
        appliedSupportNeedIds: fallback.appliedSupportNeedIds,
        appliedResponseStyleId: fallback.appliedResponseStyleId,
      },
      validation: publicValidation(validation),
      metadata: {
        requestId,
        planDigest: digestPlan(plan),
        method: 'deterministic-fallback',
        fallbackReason,
        attempts,
        usedFallback: true,
        latencyMs: Math.max(0, clock() - startedAt),
        model: generator.model,
      },
    });
  };
}
