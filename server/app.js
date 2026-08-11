import express from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { createOpenAIGenerator } from './openaiGenerator.js';
import { createGenerationOrchestrator } from './orchestrator.js';

export function createApp({ generator = createOpenAIGenerator(), logger = console } = {}) {
  const app = express();
  const orchestrate = createGenerationOrchestrator({ generator });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      providerConfigured: generator.configured,
      model: generator.model,
      schemaVersion: '2.0',
    });
  });

  app.post('/api/v1/prompts/generate', async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    try {
      const result = await orchestrate(request.body, requestId);
      logger.info?.({
        event: 'prompt_generated',
        requestId,
        method: result.metadata.method,
        fallbackReason: result.metadata.fallbackReason,
        latencyMs: Date.now() - startedAt,
      });
      response.json({ data: result });
    } catch (error) {
      if (error instanceof ZodError || error.message?.startsWith('Invalid cue request:')) {
        response.status(400).json({
          error: 'INVALID_CUE_REQUEST',
          message: 'The submitted cue structure is invalid.',
          requestId,
        });
        return;
      }

      logger.error?.({
        event: 'prompt_generation_failed',
        requestId,
        errorType: error.name,
      });
      response.status(500).json({
        error: 'GENERATION_FAILED',
        message: 'Prompt generation failed safely.',
        requestId,
      });
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: 'NOT_FOUND' });
  });

  return app;
}
