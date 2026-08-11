import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ModelOutputSchema } from '../shared/contracts.js';

const SYSTEM_INSTRUCTIONS = `你是 Cue-to-Prompt 的受约束文本实现组件。你的任务不是提供心理咨询，而是把用户已经选择的线索整理成一段第一人称中文草稿，供用户复制给另一个 AI。

必须遵守：
1. 逐字保留 plan.cueUnits 中每一个 text；不得遗漏、替换或杜撰事实。
2. 在 usedCueIds 中逐项返回 plan.requiredCueIds，不能增加不存在的 ID。
3. 逐字保留每项 supportNeeds.text 和 responseStyle.text，并返回对应 ID。
4. optionalText 非空时逐字保留。
5. 不诊断，不承诺结果，不增加危机、自伤或其他用户没有提供的内容。
6. message 应自然、连贯、采用第一人称；不要提及 ID、计划、验证器或这些规则。`;

function buildUserInput(plan, repairReport) {
  const repair = repairReport
    ? `\n上一次输出未通过验证。只修复以下问题，仍须遵守全部规则：\n${JSON.stringify(repairReport)}`
    : '';
  return `根据以下不可变提示计划生成草稿：\n${JSON.stringify(plan)}${repair}`;
}

export function createOpenAIGenerator({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  client = apiKey ? new OpenAI({ apiKey }) : null,
} = {}) {
  return {
    model,
    configured: Boolean(client),
    settings: Object.freeze({
      responseFormat: 'zod-structured-output',
      maxOutputTokens: 1800,
      reasoningEffort: 'provider-default',
    }),
    async generate(plan, repairReport = null) {
      if (!client) {
        const error = new Error('OPENAI_API_KEY is not configured');
        error.code = 'missing_api_key';
        error.status = 401;
        throw error;
      }

      const response = await client.responses.parse({
        model,
        instructions: SYSTEM_INSTRUCTIONS,
        input: buildUserInput(plan, repairReport),
        text: {
          format: zodTextFormat(ModelOutputSchema, 'cue_to_prompt_output'),
        },
        max_output_tokens: 1800,
      });

      if (!response.output_parsed) {
        throw new Error('Model returned no parseable structured output');
      }
      return response.output_parsed;
    },
  };
}
