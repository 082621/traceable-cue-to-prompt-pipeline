export function validRequest(overrides = {}) {
  return {
    sessionId: 'test-session-001',
    selectedConcerns: ['academic', 'future', 'social'],
    concernData: {
      academic: {
        cues: ['截止日期都堆在一起'],
        emotions: ['焦虑'],
        impacts: ['很难专心'],
        customCue: '',
        customEmotion: '',
        customImpact: '',
      },
      future: {
        cues: ['不知道毕业后要做什么'],
        emotions: ['迷茫'],
        impacts: ['很难做决定'],
        customCue: '',
        customEmotion: '',
        customImpact: '',
      },
      social: {
        cues: ['感觉自己很孤单'],
        emotions: ['孤独'],
        impacts: ['让我更难和别人沟通'],
        customCue: '',
        customEmotion: '',
        customImpact: '',
      },
    },
    supportNeeds: ['帮我整理思路', '情绪安慰'],
    responseStyle: '一步一步地帮我分析',
    optionalText: '最近睡眠也不太规律。',
    locale: 'zh-CN',
    ...overrides,
  };
}
