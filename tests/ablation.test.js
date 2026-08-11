import { describe, expect, it, vi } from 'vitest';
import { benchmarkCases } from '../benchmark/cases.js';
import {
  createRandomisedTasks,
  evaluateAblationRun,
  summariseAblation,
} from '../benchmark/ablationCore.js';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';

describe('expanded synthetic corpus', () => {
  it('contains 30 unique, schema-valid deterministic cases', () => {
    expect(benchmarkCases).toHaveLength(30);
    expect(new Set(benchmarkCases.map((testCase) => testCase.id)).size).toBe(30);
    benchmarkCases.forEach((testCase) => {
      expect(() => buildPromptPlan(testCase.request)).not.toThrow();
    });
  });

  it('creates a reproducible randomised repeated-run order', () => {
    const first = createRandomisedTasks(benchmarkCases.slice(0, 3), 3, 42)
      .map(({ testCase, repeat }) => `${testCase.id}-${repeat}`);
    const second = createRandomisedTasks(benchmarkCases.slice(0, 3), 3, 42)
      .map(({ testCase, repeat }) => `${testCase.id}-${repeat}`);

    expect(first).toEqual(second);
    expect(first).toHaveLength(9);
    expect(new Set(first).size).toBe(9);
  });
});

describe('paired ablation evaluation', () => {
  it('reuses a rejected raw candidate and records successful pipeline repair', async () => {
    const generator = {
      model: 'fake-model',
      configured: true,
      generate: vi.fn(async (plan) => {
        const output = generateDeterministicPrompt(plan);
        if (generator.generate.mock.calls.length === 1) {
          output.message = output.message.replace(plan.cueUnits[0].text, '【遗漏】');
        }
        return output;
      }),
    };

    const row = await evaluateAblationRun({
      testCase: benchmarkCases[0],
      repeat: 1,
      generator,
    });

    expect(row.conditions.deterministic.accepted).toBe(true);
    expect(row.conditions.modelOnly.accepted).toBe(false);
    expect(row.conditions.fullPipeline.accepted).toBe(true);
    expect(row.conditions.fullPipeline.method).toBe('model-repair');
    expect(row.providerCalls).toBe(2);
    expect(generator.generate).toHaveBeenCalledTimes(2);

    const unavailableGenerator = {
      model: 'unavailable-model',
      configured: true,
      generate: vi.fn(async () => {
        const error = new Error('Injected provider failure');
        error.code = 'invalid_api_key';
        throw error;
      }),
    };
    const unavailable = await evaluateAblationRun({
      testCase: benchmarkCases[0],
      repeat: 2,
      generator: unavailableGenerator,
    });
    expect(unavailable.conditions.modelOnly.errorClass).toBe('invalid_api_key');
    expect(unavailable.conditions.fullPipeline.method).toBe('deterministic-fallback');
  });

  it('does not make a second provider call when the shared raw candidate passes', async () => {
    const generator = {
      model: 'fake-model',
      configured: true,
      generate: vi.fn(async (plan) => generateDeterministicPrompt(plan)),
    };
    const row = await evaluateAblationRun({
      testCase: benchmarkCases[1],
      repeat: 1,
      generator,
    });

    expect(row.conditions.modelOnly.accepted).toBe(true);
    expect(row.conditions.fullPipeline.method).toBe('model');
    expect(row.providerCalls).toBe(1);
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });

  it('summarises all three conditions without storing message text', async () => {
    const generator = {
      model: 'fake-model',
      configured: true,
      generate: vi.fn(async (plan) => generateDeterministicPrompt(plan)),
    };
    const rows = await Promise.all([
      evaluateAblationRun({ testCase: benchmarkCases[0], repeat: 1, generator }),
      evaluateAblationRun({ testCase: benchmarkCases[0], repeat: 2, generator }),
    ]);
    const summary = summariseAblation(rows);

    expect(summary.runCount).toBe(2);
    expect(summary.conditions.deterministic.acceptanceRate).toBe(1);
    expect(summary.conditions.fullPipeline.firstPassCount).toBe(2);
    expect(JSON.stringify(rows)).not.toContain('"message":');
  });
});
