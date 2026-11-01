/*
 * 向后兼容适配层：底层委托给 ai-explain.ts
 */

import {
  buildAiExplainPrompt,
  buildAiUrl,
  explainWithAi,
  type BuildAiPromptOptions,
} from './ai-explain'

export type BuildGeminiPromptOptions = BuildAiPromptOptions

export const buildGeminiExplainPrompt = buildAiExplainPrompt

export function buildGeminiUrl(prompt: string): string {
  return buildAiUrl('gemini', prompt)
}

export function explainWithGemini(prompt: string): Promise<boolean> {
  return explainWithAi(prompt, 'gemini')
}
