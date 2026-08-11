import { describe, expect, it } from 'vitest';
import { EDGE_CATEGORIES, edgeCases } from '../benchmark/edgeCases.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validateModelOutput } from '../shared/outputValidator.js';
import { buildPromptPlan } from '../shared/promptPlanner.js';

describe('20-case edge corpus', () => {
  it('contains four unique cases in each declared category', () => {
    expect(edgeCases).toHaveLength(20);
    expect(new Set(edgeCases.map((testCase) => testCase.id)).size).toBe(20);
    for (const category of EDGE_CATEGORIES) {
      expect(edgeCases.filter((testCase) => testCase.category === category)).toHaveLength(4);
    }
  });

  it('contains schema-valid states with accepted deterministic references', () => {
    for (const testCase of edgeCases) {
      const plan = buildPromptPlan(testCase.request);
      const report = validateModelOutput(plan, generateDeterministicPrompt(plan));
      expect(report).toMatchObject({ accepted: true, cueIdCoverage: 1, cueTextCoverage: 1 });
    }
  });

  it('preserves authored sensitive wording while rejecting model-added claims', () => {
    const authoredCase = edgeCases.find((testCase) => testCase.id === 'edge-18');
    const plan = buildPromptPlan(authoredCase.request);
    const authoredOutput = generateDeterministicPrompt(plan);
    expect(validateModelOutput(plan, authoredOutput).safetyFlags).toEqual([]);

    authoredOutput.message += ' 你患有抑郁症。';
    const fabricated = validateModelOutput(plan, authoredOutput);
    expect(fabricated.accepted).toBe(false);
    expect(fabricated.safetyFlags).toContain('diagnosis');
  });
});
