import { ModelOutputSchema } from './contracts.js';

const unique = (values) => [...new Set(values)];
const missingFrom = (required, actual) => required.filter((value) => !actual.includes(value));
const unknownFrom = (actual, allowed) => unique(actual).filter((value) => !allowed.includes(value));

const SAFETY_PATTERNS = [
  { id: 'diagnosis', pattern: /你(患有|得了|被诊断为)/u },
  { id: 'guarantee', pattern: /(保证|一定)会(好起来|解决)/u },
  { id: 'fabricated-crisis', pattern: /(自杀|自残)/u },
];

export function validateModelOutput(plan, rawOutput) {
  const parsed = ModelOutputSchema.safeParse(rawOutput);
  if (!parsed.success) {
    return {
      accepted: false,
      cueIdCoverage: 0,
      cueTextCoverage: 0,
      missingCueIds: [...plan.requiredCueIds],
      missingCueTextIds: [...plan.requiredCueIds],
      unknownCueIds: [],
      missingSupportNeedIds: [...plan.requiredSupportNeedIds],
      unknownSupportNeedIds: [],
      styleMatched: false,
      optionalTextPreserved: !plan.optionalText,
      safetyFlags: ['schema-invalid'],
      schemaIssues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };
  }

  const output = parsed.data;
  const missingCueIds = missingFrom(plan.requiredCueIds, output.usedCueIds);
  const unknownCueIds = unknownFrom(output.usedCueIds, plan.requiredCueIds);
  const missingCueTextIds = plan.cueUnits
    .filter((unit) => !output.message.includes(unit.text))
    .map((unit) => unit.id);
  const missingSupportNeedIds = missingFrom(plan.requiredSupportNeedIds, output.appliedSupportNeedIds);
  const unknownSupportNeedIds = unknownFrom(output.appliedSupportNeedIds, plan.requiredSupportNeedIds);
  const supportTextPreserved = plan.supportNeeds.every((need) => output.message.includes(need.text));
  const styleMatched = output.appliedResponseStyleId === plan.responseStyle.id
    && output.message.includes(plan.responseStyle.text);
  const optionalTextPreserved = !plan.optionalText || output.message.includes(plan.optionalText);
  const participantSourceText = [
    ...plan.cueUnits.map((unit) => unit.text),
    plan.optionalText,
  ].join('\n');
  const safetyFlags = SAFETY_PATTERNS
    .filter(({ pattern }) => pattern.test(output.message) && !pattern.test(participantSourceText))
    .map(({ id }) => id);

  const cueIdCoverage = plan.requiredCueIds.length
    ? (plan.requiredCueIds.length - missingCueIds.length) / plan.requiredCueIds.length
    : 1;
  const cueTextCoverage = plan.requiredCueIds.length
    ? (plan.requiredCueIds.length - missingCueTextIds.length) / plan.requiredCueIds.length
    : 1;

  return {
    accepted: missingCueIds.length === 0
      && unknownCueIds.length === 0
      && missingCueTextIds.length === 0
      && missingSupportNeedIds.length === 0
      && unknownSupportNeedIds.length === 0
      && supportTextPreserved
      && styleMatched
      && optionalTextPreserved
      && safetyFlags.length === 0,
    cueIdCoverage,
    cueTextCoverage,
    missingCueIds,
    missingCueTextIds,
    unknownCueIds,
    missingSupportNeedIds,
    unknownSupportNeedIds,
    styleMatched,
    optionalTextPreserved,
    safetyFlags: supportTextPreserved ? safetyFlags : [...safetyFlags, 'support-text-missing'],
  };
}
