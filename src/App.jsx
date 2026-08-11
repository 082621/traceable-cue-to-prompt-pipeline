import React, { useState } from 'react';
import {
  Check,
  Copy,
  MessageCircle,
  ArrowRight,
  Layout,
  Users,
  Compass,
  Home,
  BookOpen,
  Heart,
  Sparkles,
} from 'lucide-react';
import {
  CONCERN_DEFINITIONS,
  EMOTIONS,
  IMPACTS,
  SUPPORT_NEEDS,
  RESPONSE_STYLES,
} from '../shared/catalogue.js';
import { createGenerationRequest, buildPromptPlan } from '../shared/promptPlanner.js';
import { generateDeterministicPrompt } from '../shared/deterministicGenerator.js';
import { requestGeneratedPrompt } from './services/promptApi.js';

// --- 数据配置 ---
const CONCERN_ICONS = {
  academic: <BookOpen className="w-5 h-5" />,
  future: <Compass className="w-5 h-5" />,
  family: <Home className="w-5 h-5" />,
  social: <Users className="w-5 h-5" />,
  culture: <Sparkles className="w-5 h-5" />,
};

const CONCERNS_CONFIG = CONCERN_DEFINITIONS.map((concern) => ({
  ...concern,
  icon: CONCERN_ICONS[concern.id],
}));

// --- 颜色系统 ---
const COLORS = {
  bgPrimary: '#F8F6F0',
  bgSecondary: '#F7F3E8',
  bgWarm: '#FAF4E0',

  cardDefault: '#FFFFFF',
  cardMuted: '#FAF4E0',

  primary: '#C7E5C9',
  primaryHover: '#B8DBBB',
  primaryDisabled: '#E5E5E5',

  helper: '#EDF1CF',
  selectedBorder: '#C7E5C9',

  textPrimary: '#4A4A4A',
  textSecondary: '#666666',
  textTertiary: '#8A8A8A',

  border: '#E8E2D8',
  divider: '#ECE7DE',
};

const CONCERN_COLORS = {
  academic: {
    main: '#F3E5C0',
    soft: '#FAF4E0',
    accent: '#D7B97A',
  },
  future: {
    main: '#F8D6B8',
    soft: '#FFCDBC',
    accent: '#E0A77F',
  },
  family: {
    main: '#F9E6E6',
    soft: '#F9B7BE',
    accent: '#D99AA2',
  },
  social: {
    main: '#DECCE6',
    soft: '#EADDF0',
    accent: '#B79AC6',
  },
  culture: {
    main: '#C7E5C9',
    soft: '#EDF1CF',
    accent: '#7FAF88',
  },
};

const getConcernColor = (id) => CONCERN_COLORS[id] || CONCERN_COLORS.culture;

// --- 子组件：进度条 ---
const ProgressBar = ({ current, total }) => {
  const progress = (current / total) * 100;
  return (
    <div
      className="w-full h-1 rounded-full overflow-hidden mb-8"
      style={{ backgroundColor: COLORS.helper }}
    >
      <div
        className="h-full transition-all duration-500 ease-out"
        style={{
          width: `${progress}%`,
          backgroundColor: COLORS.primary,
        }}
      />
    </div>
  );
};

// --- 主应用 ---
export default function App() {
  const [step, setStep] = useState(0);
  const [selectedConcerns, setSelectedConcerns] = useState([]);
  const [concernData, setConcernData] = useState({});
  const [supportNeeds, setSupportNeeds] = useState([]);
  const [responseStyle, setResponseStyle] = useState('');
  const [optionalText, setOptionalText] = useState('');
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [generation, setGeneration] = useState({ status: 'idle', result: null, error: null });

  const concernStepIndex = step >= 2 && step <= 4 ? step - 2 : null;
  const currentConcern =
    concernStepIndex !== null
      ? CONCERNS_CONFIG.find((c) => c.id === selectedConcerns[concernStepIndex])
      : null;

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const toggleConcern = (id) => {
    if (selectedConcerns.includes(id)) {
      setSelectedConcerns(selectedConcerns.filter((i) => i !== id));
    } else if (selectedConcerns.length < 3) {
      setSelectedConcerns([...selectedConcerns, id]);
    }
  };

  const updateConcernData = (id, field, value) => {
    setConcernData((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          cues: [],
          emotions: [],
          impacts: [],
          customCue: '',
          customEmotion: '',
          customImpact: '',
          showCustomCue: false,
          showCustomEmotion: false,
          showCustomImpact: false,
        }),
        [field]: value,
      },
    }));
  };

  const isConcernComplete = (id) => {
    const data = concernData[id];
    if (!data) return false;

    const hasCue = data.cues?.length > 0 || data.customCue?.trim();
    const hasEmotion = data.emotions?.length > 0 || data.customEmotion?.trim();
    const hasImpact = data.impacts?.length > 0 || data.customImpact?.trim();

    return hasCue && hasEmotion && hasImpact;
  };

  const createCurrentRequest = () => createGenerationRequest({
    selectedConcerns,
    concernData,
    supportNeeds,
    responseStyle,
    optionalText,
  });

  const generateBaselinePrompt = () => {
    if (!selectedConcerns.length) return '';
    return generateDeterministicPrompt(buildPromptPlan(createCurrentRequest())).message;
  };

  const currentPrompt = () => generation.result?.message || generateBaselinePrompt();

  const handleGenerate = async () => {
    const request = createCurrentRequest();
    setStep(7);
    setGeneration({ status: 'loading', result: null, error: null });
    try {
      const result = await requestGeneratedPrompt(request);
      setGeneration({ status: 'ready', result, error: null });
    } catch (error) {
      setGeneration({
        status: 'fallback',
        result: null,
        error: error instanceof Error ? error.message : '生成服务暂时不可用',
      });
    }
  };

  const copyToClipboard = () => {
    const text = currentPrompt();
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setShowCopyFeedback(true);
      setTimeout(() => setShowCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const pageBackground = () => {
    if (step >= 2 && step <= 4) return COLORS.bgSecondary;
    return COLORS.bgPrimary;
  };

  // Screen 0: Scenario Entry
  const renderStep0 = () => (
    <div className="flex flex-col items-center text-center py-8">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: COLORS.helper, color: COLORS.textPrimary }}
      >
        <MessageCircle size={32} />
      </div>

      <h1 className="text-2xl font-bold mb-4" style={{ color: COLORS.textPrimary }}>
        我们先一起理清你现在想说的内容
      </h1>

      <p className="mb-8 max-w-md" style={{ color: COLORS.textSecondary }}>
        你不需要一次把所有事情都说清楚。我们会一步一步帮你整理。
      </p>

      <div
        className="p-6 rounded-2xl text-left mb-10 leading-relaxed border"
        style={{
          backgroundColor: COLORS.bgWarm,
          borderColor: COLORS.border,
        }}
      >
        <p className="text-sm" style={{ color: COLORS.textSecondary }}>
          建议使用场景：
          <br />
          假设你现在是一名在英国留学的中国学生。最近你正处于一个压力比较大的阶段，生活中可能有几件事情同时影响着你的状态。你想向 AI 寻求一些支持，但在真正开口之前，你需要先理清楚自己想说什么。
        </p>
      </div>

      <button
        onClick={handleNext}
        className="px-10 py-4 rounded-full font-medium transition-all shadow-lg flex items-center gap-2 group"
        style={{
          backgroundColor: COLORS.primary,
          color: COLORS.textPrimary,
          boxShadow: '0 10px 26px rgba(199, 229, 201, 0.45)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.primaryHover)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.primary)}
      >
        开始整理 <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </button>

      <p className="mt-6 text-xs" style={{ color: COLORS.textTertiary }}>
        整个过程大约需要 3–5 分钟
      </p>
    </div>
  );

  // Screen 1: Concern Selection
  const renderStep1 = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
          现在最压在你心上的三件事是什么？
        </h2>
        <p style={{ color: COLORS.textSecondary }}>
          请选择 3 个你现在最想倾诉、最想整理的问题。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8">
        {CONCERNS_CONFIG.map((item) => {
          const isSelected = selectedConcerns.includes(item.id);
          const theme = getConcernColor(item.id);

          return (
            <div
              key={item.id}
              onClick={() => toggleConcern(item.id)}
              className="relative p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4"
              style={{
                backgroundColor: isSelected ? theme.main : COLORS.cardMuted,
                borderColor: isSelected ? theme.accent : 'transparent',
                boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.04)' : 'none',
              }}
            >
              <div
                className="p-3 rounded-xl"
                style={{
                  backgroundColor: isSelected ? theme.soft : COLORS.bgPrimary,
                  color: COLORS.textPrimary,
                }}
              >
                {item.icon}
              </div>

              <div className="flex-1">
                <h3 className="font-bold" style={{ color: COLORS.textPrimary }}>
                  {item.title}
                </h3>
                <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
                  {item.desc}
                </p>
              </div>

              {isSelected && (
                <div
                  className="absolute right-4 top-4 rounded-full p-1"
                  style={{ backgroundColor: theme.accent, color: COLORS.textPrimary }}
                >
                  <Check size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-auto pt-6 border-t" style={{ borderColor: COLORS.divider }}>
        <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
          已选择 {selectedConcerns.length} / 3
        </span>

        <div className="flex gap-3">
          <button onClick={handleBack} className="px-6 py-3 font-medium" style={{ color: COLORS.textSecondary }}>
            返回
          </button>

          <button
            disabled={selectedConcerns.length !== 3}
            onClick={handleNext}
            className="px-8 py-3 rounded-full font-medium transition-all"
            style={{
              backgroundColor: selectedConcerns.length === 3 ? COLORS.primary : COLORS.primaryDisabled,
              color: selectedConcerns.length === 3 ? COLORS.textPrimary : COLORS.textTertiary,
              boxShadow: selectedConcerns.length === 3 ? '0 10px 26px rgba(199, 229, 201, 0.45)' : 'none',
              cursor: selectedConcerns.length === 3 ? 'pointer' : 'not-allowed',
            }}
          >
            继续
          </button>
        </div>
      </div>
    </div>
  );

  // Screen 2, 3, 4: Concern Cue Collection
  const renderConcernCues = () => {
    if (!currentConcern) return null;

    const data = concernData[currentConcern.id] || {
      cues: [],
      emotions: [],
      impacts: [],
      customCue: '',
      customEmotion: '',
      customImpact: '',
      showCustomCue: false,
      showCustomEmotion: false,
      showCustomImpact: false,
    };

    const theme = getConcernColor(currentConcern.id);

    const toggleTag = (field, tag) => {
      const currentTags = data[field];
      if (currentTags.includes(tag)) {
        updateConcernData(currentConcern.id, field, currentTags.filter((t) => t !== tag));
      } else {
        updateConcernData(currentConcern.id, field, [...currentTags, tag]);
      }
    };

    const inputClass = 'w-full px-4 py-3 rounded-xl border bg-white text-sm outline-none';

    const chipStyle = (selected) => ({
      backgroundColor: selected ? COLORS.helper : COLORS.cardDefault,
      color: COLORS.textPrimary,
      borderColor: selected ? COLORS.primary : COLORS.border,
      boxShadow: selected ? '0 4px 14px rgba(199, 229, 201, 0.25)' : 'none',
    });

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-500">
        <div
          className="mb-8 rounded-3xl p-6 border"
          style={{
            backgroundColor: theme.main,
            borderColor: theme.accent,
          }}
        >
          <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
            关于「{currentConcern.title}」
          </h2>
          <p style={{ color: COLORS.textSecondary }}>
            请从下面的内容中选出最符合你现在状态的部分。
          </p>
        </div>

        <div className="space-y-10">
          {/* Section A */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: COLORS.textPrimary }}>
              A. 这件事现在主要是什么情况？
            </h3>
            <div className="flex flex-wrap gap-3">
              {currentConcern.cues.map((cue) => (
                <button
                  key={cue}
                  onClick={() => toggleTag('cues', cue)}
                  className="px-4 py-2 rounded-xl text-sm transition-all border"
                  style={chipStyle(data.cues.includes(cue))}
                >
                  {cue}
                </button>
              ))}

              <button
                onClick={() => {
                  const nextShow = !data.showCustomCue;
                  updateConcernData(currentConcern.id, 'showCustomCue', nextShow);
                  if (!nextShow) {
                    updateConcernData(currentConcern.id, 'customCue', '');
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm transition-all border"
                style={chipStyle(data.showCustomCue)}
              >
                其他
              </button>
            </div>

            {data.showCustomCue && (
              <div className="mt-4">
                <input
                  type="text"
                  autoFocus
                  value={data.customCue}
                  onChange={(e) => updateConcernData(currentConcern.id, 'customCue', e.target.value)}
                  placeholder="用一句话补充这件事里对你最重要、但选项里没有的内容"
                  className={inputClass}
                  style={{
                    borderColor: COLORS.border,
                    color: COLORS.textPrimary,
                  }}
                />
              </div>
            )}
          </section>

          {/* Section B */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: COLORS.textPrimary }}>
              B. 这件事让你有什么感受？
            </h3>
            <div className="flex flex-wrap gap-3">
              {EMOTIONS.map((emo) => (
                <button
                  key={emo}
                  onClick={() => toggleTag('emotions', emo)}
                  className="px-4 py-2 rounded-xl text-sm transition-all border"
                  style={chipStyle(data.emotions.includes(emo))}
                >
                  {emo}
                </button>
              ))}

              <button
                onClick={() => {
                  const nextShow = !data.showCustomEmotion;
                  updateConcernData(currentConcern.id, 'showCustomEmotion', nextShow);
                  if (!nextShow) {
                    updateConcernData(currentConcern.id, 'customEmotion', '');
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm transition-all border"
                style={chipStyle(data.showCustomEmotion)}
              >
                其他
              </button>
            </div>

            {data.showCustomEmotion && (
              <div className="mt-4">
                <input
                  type="text"
                  autoFocus
                  value={data.customEmotion}
                  onChange={(e) => updateConcernData(currentConcern.id, 'customEmotion', e.target.value)}
                  placeholder="你还可以补充一个更贴近你状态的感受词"
                  className={inputClass}
                  style={{
                    borderColor: COLORS.border,
                    color: COLORS.textPrimary,
                  }}
                />
              </div>
            )}
          </section>

          {/* Section C */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: COLORS.textPrimary }}>
              C. 它现在最明显地影响了你什么？
            </h3>
            <div className="flex flex-wrap gap-3">
              {IMPACTS.map((impact) => (
                <button
                  key={impact}
                  onClick={() => toggleTag('impacts', impact)}
                  className="px-4 py-2 rounded-xl text-sm transition-all border"
                  style={chipStyle(data.impacts.includes(impact))}
                >
                  {impact}
                </button>
              ))}

              <button
                onClick={() => {
                  const nextShow = !data.showCustomImpact;
                  updateConcernData(currentConcern.id, 'showCustomImpact', nextShow);
                  if (!nextShow) {
                    updateConcernData(currentConcern.id, 'customImpact', '');
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm transition-all border"
                style={chipStyle(data.showCustomImpact)}
              >
                其他
              </button>
            </div>

            {data.showCustomImpact && (
              <div className="mt-4">
                <input
                  type="text"
                  autoFocus
                  value={data.customImpact}
                  onChange={(e) => updateConcernData(currentConcern.id, 'customImpact', e.target.value)}
                  placeholder="补充这件事现在最明显带来的影响"
                  className={inputClass}
                  style={{
                    borderColor: COLORS.border,
                    color: COLORS.textPrimary,
                  }}
                />
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end mt-12 pt-6 border-t gap-3" style={{ borderColor: COLORS.divider }}>
          <button onClick={handleBack} className="px-6 py-3 font-medium" style={{ color: COLORS.textSecondary }}>
            上一步
          </button>

          <button
            disabled={!isConcernComplete(currentConcern.id)}
            onClick={handleNext}
            className="px-8 py-3 rounded-full font-medium transition-all"
            style={{
              backgroundColor: isConcernComplete(currentConcern.id) ? COLORS.primary : COLORS.primaryDisabled,
              color: isConcernComplete(currentConcern.id) ? COLORS.textPrimary : COLORS.textTertiary,
              boxShadow: isConcernComplete(currentConcern.id) ? '0 10px 26px rgba(199, 229, 201, 0.45)' : 'none',
              cursor: isConcernComplete(currentConcern.id) ? 'pointer' : 'not-allowed',
            }}
          >
            下一步
          </button>
        </div>
      </div>
    );
  };

  // Screen 5: Overall Support Need
  const renderSupportNeeds = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
          你现在最希望得到什么样的回应？
        </h2>
        <p style={{ color: COLORS.textSecondary }}>可以选 1–2 项最符合你当前需要的。</p>
      </div>

      <div className="space-y-10">
        <section
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: COLORS.bgWarm,
            borderColor: COLORS.border,
          }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: COLORS.textPrimary }}>
            你希望得到什么支持？
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {SUPPORT_NEEDS.map((item) => (
              <button
                key={item}
                onClick={() => {
                  if (supportNeeds.includes(item)) {
                    setSupportNeeds(supportNeeds.filter((i) => i !== item));
                  } else if (supportNeeds.length < 2) {
                    setSupportNeeds([...supportNeeds, item]);
                  }
                }}
                className="p-4 rounded-xl text-left text-sm transition-all border flex justify-between items-center"
                style={{
                  backgroundColor: supportNeeds.includes(item) ? COLORS.helper : COLORS.cardDefault,
                  color: COLORS.textPrimary,
                  borderColor: supportNeeds.includes(item) ? COLORS.primary : COLORS.border,
                }}
              >
                {item}
                {supportNeeds.includes(item) && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>

        <section
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: COLORS.bgSecondary,
            borderColor: COLORS.border,
          }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: COLORS.textPrimary }}>
            你希望 AI 用什么方式回应你？
          </h3>
          <div className="flex flex-wrap gap-3">
            {RESPONSE_STYLES.map((item) => (
              <button
                key={item}
                onClick={() => setResponseStyle(item)}
                className="px-4 py-3 rounded-xl text-sm transition-all border"
                style={{
                  backgroundColor: responseStyle === item ? COLORS.helper : COLORS.cardDefault,
                  color: COLORS.textPrimary,
                  borderColor: responseStyle === item ? COLORS.primary : COLORS.border,
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end mt-12 pt-6 border-t gap-3" style={{ borderColor: COLORS.divider }}>
        <button onClick={handleBack} className="px-6 py-3 font-medium" style={{ color: COLORS.textSecondary }}>
          上一步
        </button>

        <button
          disabled={supportNeeds.length === 0 || !responseStyle}
          onClick={handleNext}
          className="px-8 py-3 rounded-full font-medium transition-all"
          style={{
            backgroundColor: supportNeeds.length > 0 && responseStyle ? COLORS.primary : COLORS.primaryDisabled,
            color: supportNeeds.length > 0 && responseStyle ? COLORS.textPrimary : COLORS.textTertiary,
            boxShadow: supportNeeds.length > 0 && responseStyle ? '0 10px 26px rgba(199, 229, 201, 0.45)' : 'none',
            cursor: supportNeeds.length > 0 && responseStyle ? 'pointer' : 'not-allowed',
          }}
        >
          继续
        </button>
      </div>
    </div>
  );

  // Screen 6: Optional Addition
  const renderOptional = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
          还有什么你想补充的吗？
        </h2>
        <p style={{ color: COLORS.textSecondary }}>这一步是可选的。如果前面已经足够表达，也可以直接继续。</p>
      </div>

      <div
        className="rounded-2xl p-6 shadow-sm border"
        style={{
          backgroundColor: COLORS.cardDefault,
          borderColor: COLORS.border,
        }}
      >
        <div
          className="rounded-2xl p-4 border mb-3"
          style={{
            backgroundColor: COLORS.bgWarm,
            borderColor: COLORS.border,
          }}
        >
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>
            这里可以写下任何你觉得重要、但前面还没有表达出来的内容。
          </p>
        </div>

        <textarea
          rows={6}
          value={optionalText}
          onChange={(e) => setOptionalText(e.target.value)}
          placeholder="写下任何你觉得重要、但前面还没有表达出来的内容。"
          className="w-full outline-none resize-none bg-transparent"
          style={{ color: COLORS.textPrimary }}
        />

        <div className="mt-4 flex justify-end">
          <span className="text-xs" style={{ color: COLORS.textTertiary }}>
            一句到几句即可
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end mt-12 pt-6 border-t gap-3" style={{ borderColor: COLORS.divider }}>
        <button onClick={handleBack} className="px-6 py-3 font-medium" style={{ color: COLORS.textSecondary }}>
          上一步
        </button>

        <button
          onClick={handleGenerate}
          className="px-8 py-3 rounded-full font-medium transition-all"
          style={{
            backgroundColor: COLORS.primary,
            color: COLORS.textPrimary,
            boxShadow: '0 10px 26px rgba(199, 229, 201, 0.45)',
          }}
        >
          {optionalText.trim() ? '继续' : '跳过并完成'}
        </button>
      </div>
    </div>
  );

  // Screen 7: Result Page
  const renderResult = () => {
    const prompt = currentPrompt();

    const overallEmotions = Array.from(
      new Set(
        selectedConcerns.flatMap((id) => {
          const data = concernData[id] || {};
          return [
            ...(data.emotions || []),
            ...(data.customEmotion?.trim() ? [data.customEmotion.trim()] : []),
          ];
        })
      )
    );

    return (
      <div className="animate-in fade-in zoom-in-95 duration-700">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.textPrimary }}>
            为你生成的整理草稿
          </h2>
          <p style={{ color: COLORS.textSecondary }}>
            系统已经根据你的选择，梳理出了这段表达。你可以直接复制给 AI。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: COLORS.textSecondary }}>
            {generation.status === 'loading' && (
              <span className="px-3 py-1 rounded-full border" style={{ backgroundColor: COLORS.cardDefault, borderColor: COLORS.border }}>
                正在生成并检查；当前显示可用的确定性草稿
              </span>
            )}
            {generation.status === 'ready' && (
              <span className="px-3 py-1 rounded-full border" style={{ backgroundColor: COLORS.helper, borderColor: COLORS.selectedBorder }}>
                {generation.result.metadata.usedFallback
                  ? generation.result.metadata.fallbackReason === 'provider-unavailable'
                    ? '在线模型不可用，已安全回退'
                    : '模型输出未通过检查，已安全回退'
                  : `完整性检查通过 · ${generation.result.metadata.method === 'model-repair' ? '自动修复 1 次' : '首次通过'}`}
              </span>
            )}
            {generation.status === 'fallback' && (
              <span className="px-3 py-1 rounded-full border" style={{ backgroundColor: COLORS.bgWarm, borderColor: COLORS.border }}>
                在线服务不可用，已使用本地确定性草稿
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Summary Card */}
          <div
            className="rounded-2xl p-6 border"
            style={{
              backgroundColor: COLORS.bgWarm,
              borderColor: COLORS.border,
            }}
          >
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
              <Layout size={16} /> 你目前整理出的重点
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold mb-2 uppercase" style={{ color: COLORS.textSecondary }}>
                  整体状态
                </p>
                <div className="flex flex-wrap gap-1">
                  {overallEmotions.map((e) => (
                    <span
                      key={e}
                      className="px-2 py-0.5 text-xs rounded-lg border"
                      style={{
                        backgroundColor: COLORS.cardDefault,
                        color: COLORS.textPrimary,
                        borderColor: COLORS.border,
                      }}
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold mb-2 uppercase" style={{ color: COLORS.textSecondary }}>
                  核心关注
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedConcerns.map((id) => {
                    const concern = CONCERNS_CONFIG.find((c) => c.id === id);
                    const theme = getConcernColor(id);
                    return (
                      <span
                        key={id}
                        className="px-3 py-1 text-xs rounded-full border"
                        style={{
                          backgroundColor: theme.main,
                          borderColor: theme.accent,
                          color: COLORS.textPrimary,
                        }}
                      >
                        {concern.title}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold mb-2 uppercase" style={{ color: COLORS.textSecondary }}>
                  需要支持
                </p>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.textPrimary }}>
                  {supportNeeds.join('、')}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold mb-2 uppercase" style={{ color: COLORS.textSecondary }}>
                  偏好风格
                </p>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.textPrimary }}>
                  {responseStyle}
                </p>
              </div>
            </div>
          </div>

          {/* Prompt Area */}
          <div
            className="relative rounded-2xl border-2 overflow-hidden group"
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderColor: COLORS.border,
            }}
          >
            <div
              className="px-6 py-3 border-b flex justify-between items-center"
              style={{
                backgroundColor: COLORS.bgWarm,
                borderColor: COLORS.border,
              }}
            >
              <span className="text-xs font-bold uppercase" style={{ color: COLORS.textPrimary }}>
                AI 表达草稿
              </span>

              <button
                onClick={copyToClipboard}
                className="text-xs flex items-center gap-1 font-bold px-3 py-1 rounded-full shadow-sm border transition-all active:scale-95"
                style={{
                  backgroundColor: COLORS.cardDefault,
                  color: COLORS.textPrimary,
                  borderColor: COLORS.border,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = COLORS.cardDefault;
                }}
              >
                {showCopyFeedback ? (
                  <>
                    <Check size={12} /> 已复制
                  </>
                ) : (
                  <>
                    <Copy size={12} /> 复制内容
                  </>
                )}
              </button>
            </div>

            <div className="p-6 text-sm leading-relaxed whitespace-pre-wrap font-serif" style={{ color: COLORS.textPrimary }}>
              {prompt}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-12 pt-6 border-t" style={{ borderColor: COLORS.divider }}>
          <button
            onClick={handleBack}
            className="px-6 py-3 font-medium transition-colors"
            style={{ color: COLORS.textTertiary }}
          >
            返回修改
          </button>

          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 border rounded-full font-medium transition-all"
              style={{
                backgroundColor: COLORS.cardDefault,
                borderColor: COLORS.border,
                color: COLORS.textSecondary,
              }}
            >
              重新整理
            </button>

            <button
              className="px-8 py-3 rounded-full font-medium shadow-lg transition-all flex items-center gap-2"
              style={{
                backgroundColor: COLORS.primary,
                color: COLORS.textPrimary,
                boxShadow: '0 10px 26px rgba(199, 229, 201, 0.45)',
              }}
            >
              确认使用这段草稿 <Check size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen font-sans"
      style={{
        backgroundColor: pageBackground(),
        color: COLORS.textPrimary,
      }}
    >
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col min-h-screen">
        {/* Header / Branding */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: COLORS.primary, color: COLORS.textPrimary }}
            >
              <Heart size={18} fill="currentColor" />
            </div>
            <span className="font-bold tracking-tight" style={{ color: COLORS.textPrimary }}>
              Cue-to-Prompt
            </span>
          </div>

          {step > 0 && step < 7 && (
            <div
              className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border"
              style={{
                color: COLORS.textSecondary,
                backgroundColor: COLORS.cardDefault,
                borderColor: COLORS.border,
              }}
            >
              步骤 {step} / 6
            </div>
          )}
        </header>

        {/* Progress Bar */}
        {step > 0 && step < 7 && <ProgressBar current={step} total={6} />}

        {/* Main Content Area */}
        <main className="flex-1">
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step >= 2 && step <= 4 && renderConcernCues()}
          {step === 5 && renderSupportNeeds()}
          {step === 6 && renderOptional()}
          {step === 7 && renderResult()}
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center py-6">
          <p className="text-xs" style={{ color: COLORS.textTertiary }}>
            Cue-to-Prompt v2.0 • 可验证结构化提示生成原型
          </p>
        </footer>
      </div>
    </div>
  );
}
