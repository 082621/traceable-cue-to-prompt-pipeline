import {
  CONCERN_DEFINITIONS,
  EMOTIONS,
  IMPACTS,
  SUPPORT_NEEDS,
  RESPONSE_STYLES,
} from '../shared/catalogue.js';

const CONCERN_TRIPLES = [
  ['academic', 'future', 'family'],
  ['academic', 'future', 'social'],
  ['academic', 'future', 'culture'],
  ['academic', 'family', 'social'],
  ['academic', 'family', 'culture'],
  ['academic', 'social', 'culture'],
  ['future', 'family', 'social'],
  ['future', 'family', 'culture'],
  ['future', 'social', 'culture'],
  ['family', 'social', 'culture'],
];

const CUSTOM_TEXT = {
  academic: {
    cue: '这周的学习安排比平时更密集',
    emotion: '有些招架不住',
    impact: '让我很难安排休息时间',
  },
  future: {
    cue: '身边的人最近都在谈论毕业计划',
    emotion: '不太踏实',
    impact: '让我一直推迟做选择',
  },
  family: {
    cue: '最近和家里通话时总会谈到未来',
    emotion: '有些为难',
    impact: '让我不知道该怎么说明自己的想法',
  },
  social: {
    cue: '最近很少有机会和熟悉的人深入聊天',
    emotion: '有些失落',
    impact: '让我更不愿意主动联系别人',
  },
  culture: {
    cue: '最近参加新环境里的活动时不太自在',
    emotion: '有些无所适从',
    impact: '让我在表达前反复斟酌',
  },
};

function definitionFor(id) {
  return CONCERN_DEFINITIONS.find((concern) => concern.id === id);
}

function concernInput(id, tripleIndex, variant) {
  const definition = definitionFor(id);
  const seed = tripleIndex * 3 + variant;
  const includeCustom = variant > 0;
  return {
    cues: [definition.cues[seed % definition.cues.length]],
    emotions: [EMOTIONS[(seed + definition.cues.length) % EMOTIONS.length]],
    impacts: [IMPACTS[(seed * 2 + definition.cues.length) % IMPACTS.length]],
    customCue: includeCustom && seed % 3 === 0 ? CUSTOM_TEXT[id].cue : '',
    customEmotion: includeCustom && seed % 3 === 1 ? CUSTOM_TEXT[id].emotion : '',
    customImpact: includeCustom && seed % 3 === 2 ? CUSTOM_TEXT[id].impact : '',
  };
}

function makeCase(triple, tripleIndex, variant) {
  const caseNumber = tripleIndex * 3 + variant + 1;
  const caseId = `B${String(caseNumber).padStart(2, '0')}`;
  const supportStart = (tripleIndex + variant) % SUPPORT_NEEDS.length;
  const supportNeeds = variant === 2
    ? [SUPPORT_NEEDS[supportStart], SUPPORT_NEEDS[(supportStart + 2) % SUPPORT_NEEDS.length]]
    : [SUPPORT_NEEDS[supportStart]];

  return {
    id: caseId,
    factors: {
      concernCombination: tripleIndex + 1,
      variant: variant + 1,
      includesCustomText: variant > 0,
      supportNeedCount: supportNeeds.length,
    },
    request: {
      sessionId: `synthetic-${caseId}`,
      selectedConcerns: triple,
      concernData: Object.fromEntries(
        triple.map((id) => [id, concernInput(id, tripleIndex, variant)]),
      ),
      supportNeeds,
      responseStyle: RESPONSE_STYLES[(tripleIndex * 2 + variant) % RESPONSE_STYLES.length],
      optionalText: variant === 2
        ? '这是合成测试补充：希望先确定最需要处理的顺序。'
        : '',
      locale: 'zh-CN',
    },
  };
}

// All ten combinations of three concerns, each in three deterministic variants.
// The corpus is synthetic and contains no participant or personal data.
export const benchmarkCases = CONCERN_TRIPLES.flatMap((triple, tripleIndex) =>
  [0, 1, 2].map((variant) => makeCase(triple, tripleIndex, variant))
);
