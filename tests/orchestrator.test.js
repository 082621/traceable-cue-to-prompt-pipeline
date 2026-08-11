import { describe, expect, it, vi } from 'vitest';
import { createGenerationOrchestrator } from '../server/orchestrator.js';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validRequest } from './fixtures.js';

describe('generation orchestrator', () => {
  it('returns a valid first-pass structured output', async () => {
    const generator = {
      model: 'fake-model',
      generate: vi.fn(async (plan) => generateDeterministicPrompt(plan)),
    };
    const orchestrate = createGenerationOrchestrator({ generator, clock: () => 100 });
    const result = await orchestrate(validRequest(), 'request-1');

    expect(result.validation.accepted).toBe(true);
    expect(result.metadata.method).toBe('model');
    expect(result.metadata.fallbackReason).toBe('none');
    expect(result.metadata.attempts).toBe(1);
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });

  it('produces the same semantic plan digest when only the session ID changes', async () => {
    const generator = {
      model: 'fake-model',
      generate: vi.fn(async (plan) => generateDeterministicPrompt(plan)),
    };
    const orchestrate = createGenerationOrchestrator({ generator });
    const first = await orchestrate(validRequest({ sessionId: 'session-a' }), 'request-a');
    const second = await orchestrate(validRequest({ sessionId: 'session-b' }), 'request-b');

    expect(first.metadata.planDigest).toBe(second.metadata.planDigest);
  });

  it('passes a validation report into one bounded repair attempt', async () => {
    const plan = buildPromptPlan(validRequest());
    const invalid = generateDeterministicPrompt(plan);
    invalid.message = invalid.message.replace('截止日期都堆在一起', '事情很多');
    const generator = {
      model: 'fake-model',
      generate: vi.fn()
        .mockResolvedValueOnce(invalid)
        .mockImplementationOnce(async (receivedPlan, report) => {
          expect(report.missingCueTextIds).toContain('academic.situation.1');
          return generateDeterministicPrompt(receivedPlan);
        }),
    };
    const result = await createGenerationOrchestrator({ generator })(validRequest(), 'request-2');

    expect(result.metadata.method).toBe('model-repair');
    expect(result.metadata.attempts).toBe(2);
    expect(result.metadata.usedFallback).toBe(false);
  });

  it('uses a validated deterministic fallback after two provider failures', async () => {
    const generator = {
      model: 'offline-model',
      generate: vi.fn(async () => { throw new Error('network unavailable'); }),
    };
    const result = await createGenerationOrchestrator({ generator })(validRequest(), 'request-3');

    expect(result.metadata.method).toBe('deterministic-fallback');
    expect(result.metadata.usedFallback).toBe(true);
    expect(result.metadata.fallbackReason).toBe('provider-unavailable');
    expect(result.metadata.attempts).toBe(2);
    expect(result.validation.cueTextCoverage).toBe(1);
  });

  it('does not retry a non-retryable quota failure', async () => {
    const quotaError = Object.assign(new Error('No credits'), {
      status: 429,
      code: 'insufficient_quota',
    });
    const generator = {
      model: 'offline-model',
      generate: vi.fn(async () => { throw quotaError; }),
    };
    const result = await createGenerationOrchestrator({ generator })(validRequest(), 'request-4');

    expect(result.metadata.method).toBe('deterministic-fallback');
    expect(result.metadata.attempts).toBe(1);
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });
});
