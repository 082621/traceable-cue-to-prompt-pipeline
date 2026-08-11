import { describe, expect, it } from 'vitest';
import {
  CueRequestSchema,
  GenerationResponseSchema,
  ModelOutputSchema,
} from '../shared/contracts.js';
import { createGenerationOrchestrator } from '../server/orchestrator.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { createGenerationRequest } from '../shared/promptPlanner.js';
import { validRequest } from './fixtures.js';

describe('versioned contracts', () => {
  it('enforces request cardinality, locale, and strict top-level keys', () => {
    expect(CueRequestSchema.safeParse(validRequest()).success).toBe(true);
    expect(CueRequestSchema.safeParse(validRequest({ selectedConcerns: ['academic'] })).success).toBe(false);
    expect(CueRequestSchema.safeParse(validRequest({ locale: 'en-GB' })).success).toBe(false);
    expect(CueRequestSchema.safeParse({ ...validRequest(), injected: true }).success).toBe(false);
  });

  it('rejects short or structurally embellished provider output', () => {
    const validOutput = {
      message: '这是一段长度足够的合成测试文本，用于验证结构化模型输出只包含允许字段，并且不会因为文本过短而失败。'.repeat(2),
      usedCueIds: ['academic.situation.1'],
      appliedSupportNeedIds: ['support.1'],
      appliedResponseStyleId: 'style.1',
    };

    expect(ModelOutputSchema.safeParse(validOutput).success).toBe(true);
    expect(ModelOutputSchema.safeParse({ ...validOutput, message: '太短' }).success).toBe(false);
    expect(ModelOutputSchema.safeParse({ ...validOutput, hiddenClaim: true }).success).toBe(false);
  });

  it('normalises UI state into the versioned request boundary', () => {
    const source = validRequest();
    const request = createGenerationRequest({
      selectedConcerns: source.selectedConcerns,
      concernData: source.concernData,
      supportNeeds: source.supportNeeds,
      responseStyle: source.responseStyle,
      optionalText: source.optionalText,
      sessionId: 'normalised-session',
    });

    expect(request).toMatchObject({ sessionId: 'normalised-session', locale: 'zh-CN' });
    expect(request.concernData.academic.customCue).toBe('');
  });

  it('validates the complete response envelope and method vocabulary', async () => {
    const orchestrate = createGenerationOrchestrator({
      generator: {
        model: 'contract-test-model',
        async generate(plan) {
          return generateDeterministicPrompt(plan);
        },
      },
      clock: () => 10,
    });
    const response = await orchestrate(validRequest(), 'contract-request');

    expect(GenerationResponseSchema.safeParse(response).success).toBe(true);
    expect(GenerationResponseSchema.safeParse({
      ...response,
      metadata: { ...response.metadata, method: 'unreported-route' },
    }).success).toBe(false);
  });
});
