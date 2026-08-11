import { describe, expect, it } from 'vitest';
import { buildPromptPlan } from '../shared/promptPlanner.js';
import { validRequest } from './fixtures.js';

describe('buildPromptPlan', () => {
  it('normalises selections into stable, traceable cue identifiers', () => {
    const first = buildPromptPlan(validRequest());
    const second = buildPromptPlan(validRequest({ sessionId: 'another-session' }));

    expect(first.requiredCueIds).toEqual([
      'academic.situation.1',
      'academic.emotion.1',
      'academic.impact.1',
      'future.situation.1',
      'future.emotion.4',
      'future.impact.3',
      'social.situation.1',
      'social.emotion.3',
      'social.impact.7',
    ]);
    expect(first.requiredCueIds).toEqual(second.requiredCueIds);
  });

  it('assigns an explicit participant-source ID to custom text', () => {
    const request = validRequest();
    request.concernData.academic.customCue = '我已经连续两周赶作业';
    const plan = buildPromptPlan(request);

    expect(plan.cueUnits).toContainEqual({
      id: 'academic.situation.custom',
      text: '我已经连续两周赶作业',
      source: 'participant',
    });
  });

  it('rejects catalogue tampering before model invocation', () => {
    const request = validRequest();
    request.concernData.academic.cues = ['不存在的预设'];

    expect(() => buildPromptPlan(request)).toThrow(/unknown selection/u);
  });
});
