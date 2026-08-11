import { describe, expect, it } from 'vitest';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { validateModelOutput } from '../shared/outputValidator.js';
import { validRequest } from './fixtures.js';

describe('validateModelOutput', () => {
  const plan = buildPromptPlan(validRequest());

  it('accepts the deterministic reference implementation at full coverage', () => {
    const report = validateModelOutput(plan, generateDeterministicPrompt(plan));

    expect(report.accepted).toBe(true);
    expect(report.cueIdCoverage).toBe(1);
    expect(report.cueTextCoverage).toBe(1);
  });

  it('detects an ID claim when the corresponding cue text is missing', () => {
    const output = generateDeterministicPrompt(plan);
    output.message = output.message.replace('截止日期都堆在一起', '事情很多');
    const report = validateModelOutput(plan, output);

    expect(report.accepted).toBe(false);
    expect(report.cueIdCoverage).toBe(1);
    expect(report.missingCueTextIds).toContain('academic.situation.1');
  });

  it('detects missing and invented trace identifiers', () => {
    const output = generateDeterministicPrompt(plan);
    output.usedCueIds = output.usedCueIds.slice(1).concat('invented.cue.99');
    const report = validateModelOutput(plan, output);

    expect(report.missingCueIds).toContain('academic.situation.1');
    expect(report.unknownCueIds).toContain('invented.cue.99');
    expect(report.accepted).toBe(false);
  });
});
