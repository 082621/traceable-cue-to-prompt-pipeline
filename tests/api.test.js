import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validRequest } from './fixtures.js';

function testApp() {
  return createApp({
    generator: {
      model: 'fake-model',
      configured: true,
      generate: vi.fn(async (plan) => generateDeterministicPrompt(plan)),
    },
    logger: { info: vi.fn(), error: vi.fn() },
  });
}

describe('prompt API', () => {
  it('returns validated output without exposing server credentials', async () => {
    const response = await request(testApp())
      .post('/api/v1/prompts/generate')
      .send(validRequest())
      .expect(200);

    expect(response.body.data.validation.accepted).toBe(true);
    expect(response.body.data.metadata.model).toBe('fake-model');
    expect(JSON.stringify(response.body)).not.toContain('OPENAI_API_KEY');
  });

  it('rejects malformed cue data before calling a provider', async () => {
    const malformed = validRequest({ selectedConcerns: ['academic'] });
    const response = await request(testApp())
      .post('/api/v1/prompts/generate')
      .send(malformed)
      .expect(400);

    expect(response.body.error).toBe('INVALID_CUE_REQUEST');
  });

  it('reports provider configuration without returning a key', async () => {
    const response = await request(testApp()).get('/api/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', providerConfigured: true });
    expect(response.body).not.toHaveProperty('apiKey');

    await request(testApp()).get('/missing-route').expect(404);

    const logger = {
      info: vi.fn(() => { throw new Error('injected logger failure'); }),
      error: vi.fn(),
    };
    const failingApp = createApp({
      generator: {
        model: 'fake-model',
        configured: true,
        generate: vi.fn(async (plan) => generateDeterministicPrompt(plan)),
      },
      logger,
    });
    const failure = await request(failingApp)
      .post('/api/v1/prompts/generate')
      .send(validRequest())
      .expect(500);
    expect(failure.body.error).toBe('GENERATION_FAILED');
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
      event: 'prompt_generation_failed',
    }));
  });
});
