import { z } from 'zod';

const ConcernInputSchema = z.object({
  cues: z.array(z.string().trim().min(1)).max(6),
  emotions: z.array(z.string().trim().min(1)).max(10),
  impacts: z.array(z.string().trim().min(1)).max(10),
  customCue: z.string().trim().max(300),
  customEmotion: z.string().trim().max(100),
  customImpact: z.string().trim().max(300),
}).strict();

export const CueRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(100),
  selectedConcerns: z.array(z.string().trim().min(1)).length(3),
  concernData: z.record(z.string(), ConcernInputSchema),
  supportNeeds: z.array(z.string().trim().min(1)).min(1).max(2),
  responseStyle: z.string().trim().min(1).max(100),
  optionalText: z.string().trim().max(2000),
  locale: z.literal('zh-CN'),
}).strict();

export const ModelOutputSchema = z.object({
  message: z.string().min(50).max(5000),
  usedCueIds: z.array(z.string()),
  appliedSupportNeedIds: z.array(z.string()),
  appliedResponseStyleId: z.string(),
}).strict();

export const GenerationResponseSchema = z.object({
  message: z.string().min(1),
  trace: z.object({
    usedCueIds: z.array(z.string()),
    appliedSupportNeedIds: z.array(z.string()),
    appliedResponseStyleId: z.string(),
  }).strict(),
  validation: z.object({
    accepted: z.boolean(),
    cueIdCoverage: z.number().min(0).max(1),
    cueTextCoverage: z.number().min(0).max(1),
    missingCueIds: z.array(z.string()),
    missingCueTextIds: z.array(z.string()),
    unknownCueIds: z.array(z.string()),
    missingSupportNeedIds: z.array(z.string()),
    unknownSupportNeedIds: z.array(z.string()),
    styleMatched: z.boolean(),
    optionalTextPreserved: z.boolean(),
    safetyFlags: z.array(z.string()),
  }).strict(),
  metadata: z.object({
    requestId: z.string(),
    planDigest: z.string(),
    method: z.enum(['model', 'model-repair', 'deterministic-fallback']),
    fallbackReason: z.enum(['none', 'validation-failed', 'provider-unavailable']),
    attempts: z.number().int().min(0).max(2),
    usedFallback: z.boolean(),
    latencyMs: z.number().nonnegative(),
    model: z.string(),
  }).strict(),
}).strict();
