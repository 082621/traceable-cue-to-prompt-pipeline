import { describe, expect, it } from 'vitest';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validateModelOutput } from '../shared/outputValidator.js';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { validRequest } from './fixtures.js';

describe('deterministic reference generator', () => {
  it('preserves every planned cue, support need, style, and optional string', () => {
    const plan = buildPromptPlan(validRequest());
    const output = generateDeterministicPrompt(plan);

    for (const unit of plan.cueUnits) expect(output.message).toContain(unit.text);
    for (const need of plan.supportNeeds) expect(output.message).toContain(need.text);
    expect(output.message).toContain(plan.responseStyle.text);
    expect(output.message).toContain(plan.optionalText);
    expect(output.usedCueIds).toEqual(plan.requiredCueIds);
  });

  it('does not invent an optional closing when optional text is absent', () => {
    const plan = buildPromptPlan(validRequest({ optionalText: '' }));
    const output = generateDeterministicPrompt(plan);

    expect(output.message).not.toContain('我还想补充');
    expect(validateModelOutput(plan, output).accepted).toBe(true);
  });
});
