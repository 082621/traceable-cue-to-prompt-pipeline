const ORDINALS = ['第一', '第二', '第三'];

export function generateDeterministicPrompt(plan) {
  const allEmotions = [...new Set(plan.concerns.flatMap((concern) => concern.emotionUnits.map((unit) => unit.text)))];
  let message = `我最近同时被几件事情困扰，整体上感到${allEmotions.join('、')}。`;
  message += `目前最影响我的三件事是：${plan.concerns.map((concern) => concern.title).join('、')}。`;

  plan.concerns.forEach((concern, index) => {
    message += `\n\n${ORDINALS[index]}，关于「${concern.title}」，现在的情况是${concern.situationUnits.map((unit) => unit.text).join('、')}，`;
    message += `这让我感到${concern.emotionUnits.map((unit) => unit.text).join('、')}，也让我${concern.impactUnits.map((unit) => unit.text).join('、')}。`;
  });

  message += `\n\n我现在最需要的是${plan.supportNeeds.map((need) => need.text).join('和')}。`;
  message += `希望你能用${plan.responseStyle.text}的方式来回应我。`;
  if (plan.optionalText) {
    message += `\n\n我还想补充：${plan.optionalText}`;
  }

  return {
    message,
    usedCueIds: [...plan.requiredCueIds],
    appliedSupportNeedIds: [...plan.requiredSupportNeedIds],
    appliedResponseStyleId: plan.responseStyle.id,
  };
}
