import { describe, expect, it, vi } from 'vitest';
import { createOpenAIGenerator } from '../server/openaiGenerator.js';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validRequest } from './fixtures.js';

describe('OpenAI structured-output adapter', () => {
  it('uses the Responses parse endpoint and returns only parsed output', async () => {
    const plan = buildPromptPlan(validRequest());
    const parsed = generateDeterministicPrompt(plan);
    const parse = vi.fn(async () => ({ output_parsed: parsed }));
    const generator = createOpenAIGenerator({
      model: 'test-snapshot',
      client: { responses: { parse } },
    });

    await expect(generator.generate(plan)).resolves.toEqual(parsed);
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({
      model: 'test-snapshot',
      instructions: expect.stringContaining('逐字保留'),
      text: { format: expect.any(Object) },
    }));
  });

  it('fails closed when no parseable structured output is returned', async () => {
    const plan = buildPromptPlan(validRequest());
    const generator = createOpenAIGenerator({
      client: { responses: { parse: vi.fn(async () => ({ output_parsed: null })) } },
    });

    await expect(generator.generate(plan)).rejects.toThrow(/no parseable structured output/u);
  });

  it('classifies a missing server key as non-retryable configuration failure', async () => {
    const generator = createOpenAIGenerator({ apiKey: '', client: null });

    await expect(generator.generate(buildPromptPlan(validRequest()))).rejects.toMatchObject({
      status: 401,
      code: 'missing_api_key',
    });
  });
});
