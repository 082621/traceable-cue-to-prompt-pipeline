import { CueRequestSchema } from './contracts.js';
import {
  CONCERN_DEFINITIONS,
  EMOTIONS,
  IMPACTS,
  SUPPORT_NEEDS,
  RESPONSE_STYLES,
  concernById,
} from './catalogue.js';

const unique = (values) => [...new Set(values)];

function assertAllowed(values, allowed, path, issues) {
  values.forEach((value) => {
    if (!allowed.includes(value)) issues.push(`${path}: unknown selection "${value}"`);
  });
}

function normaliseCustom(value) {
  return value.trim();
}

function buildUnits(concernId, kind, selected, catalogue, custom) {
  const units = unique(selected).map((text) => ({
    id: `${concernId}.${kind}.${catalogue.indexOf(text) + 1}`,
    text,
    source: 'catalogue',
  }));

  const customText = normaliseCustom(custom);
  if (customText) {
    units.push({
      id: `${concernId}.${kind}.custom`,
      text: customText,
      source: 'participant',
    });
  }
  return units;
}

export function buildPromptPlan(rawRequest) {
  const request = CueRequestSchema.parse(rawRequest);
  const issues = [];

  if (unique(request.selectedConcerns).length !== 3) {
    issues.push('selectedConcerns: values must be unique');
  }

  request.selectedConcerns.forEach((concernId) => {
    if (!concernById(concernId)) issues.push(`selectedConcerns: unknown concern "${concernId}"`);
  });
  assertAllowed(request.supportNeeds, SUPPORT_NEEDS, 'supportNeeds', issues);
  assertAllowed([request.responseStyle], RESPONSE_STYLES, 'responseStyle', issues);

  const concerns = request.selectedConcerns.flatMap((concernId) => {
    const definition = concernById(concernId);
    const data = request.concernData[concernId];
    if (!definition || !data) {
      issues.push(`concernData.${concernId}: missing concern data`);
      return [];
    }

    assertAllowed(data.cues, definition.cues, `concernData.${concernId}.cues`, issues);
    assertAllowed(data.emotions, EMOTIONS, `concernData.${concernId}.emotions`, issues);
    assertAllowed(data.impacts, IMPACTS, `concernData.${concernId}.impacts`, issues);

    const situationUnits = buildUnits(concernId, 'situation', data.cues, definition.cues, data.customCue);
    const emotionUnits = buildUnits(concernId, 'emotion', data.emotions, EMOTIONS, data.customEmotion);
    const impactUnits = buildUnits(concernId, 'impact', data.impacts, IMPACTS, data.customImpact);

    if (!situationUnits.length) issues.push(`concernData.${concernId}: at least one situation cue is required`);
    if (!emotionUnits.length) issues.push(`concernData.${concernId}: at least one emotion cue is required`);
    if (!impactUnits.length) issues.push(`concernData.${concernId}: at least one impact cue is required`);

    return [{
      id: concernId,
      title: definition.title,
      situationUnits,
      emotionUnits,
      impactUnits,
    }];
  });

  if (issues.length) {
    throw new Error(`Invalid cue request: ${issues.join('; ')}`);
  }

  const supportNeeds = unique(request.supportNeeds).map((text) => ({
    id: `support.${SUPPORT_NEEDS.indexOf(text) + 1}`,
    text,
  }));
  const responseStyle = {
    id: `style.${RESPONSE_STYLES.indexOf(request.responseStyle) + 1}`,
    text: request.responseStyle,
  };
  const cueUnits = concerns.flatMap((concern) => [
    ...concern.situationUnits,
    ...concern.emotionUnits,
    ...concern.impactUnits,
  ]);

  return {
    schemaVersion: '2.0',
    sessionId: request.sessionId,
    locale: request.locale,
    concerns,
    cueUnits,
    requiredCueIds: cueUnits.map((unit) => unit.id),
    supportNeeds,
    requiredSupportNeedIds: supportNeeds.map((need) => need.id),
    responseStyle,
    optionalText: request.optionalText,
    constraints: {
      preserveCueTextVerbatim: true,
      doNotInventFacts: true,
      doNotDiagnose: true,
      outputPurpose: '供用户复制给另一个 AI 的第一人称表达草稿',
    },
  };
}

export function createGenerationRequest({
  selectedConcerns,
  concernData,
  supportNeeds,
  responseStyle,
  optionalText,
  sessionId = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`,
}) {
  const normalisedConcernData = Object.fromEntries(
    selectedConcerns.map((id) => {
      const data = concernData[id] ?? {};
      return [id, {
        cues: data.cues ?? [],
        emotions: data.emotions ?? [],
        impacts: data.impacts ?? [],
        customCue: data.customCue ?? '',
        customEmotion: data.customEmotion ?? '',
        customImpact: data.customImpact ?? '',
      }];
    }),
  );

  return CueRequestSchema.parse({
    sessionId,
    selectedConcerns,
    concernData: normalisedConcernData,
    supportNeeds,
    responseStyle,
    optionalText,
    locale: 'zh-CN',
  });
}

export const catalogueStats = Object.freeze({
  concerns: CONCERN_DEFINITIONS.length,
  situationCues: CONCERN_DEFINITIONS.reduce((sum, concern) => sum + concern.cues.length, 0),
  emotions: EMOTIONS.length,
  impacts: IMPACTS.length,
  supportNeeds: SUPPORT_NEEDS.length,
  responseStyles: RESPONSE_STYLES.length,
});
