/*
 * AI 章节解释辅助工具：
 * - 支持 DeepSeek（默认）与 Gemini 自由切换
 * - 将选中的一个或复数个小节标题 + 文章标题，组合成结构专业、易于 AI 理解并深度解答的 Prompt
 * - 复制生成的提示词到剪贴板，并唤起对应 AI 网页应用
 */

export type AiProvider = 'deepseek' | 'gemini'

export interface AiProviderConfig {
  id: AiProvider
  name: string
  label: string
  buildUrl: (prompt: string) => string
}

export const DEFAULT_AI_PROVIDER: AiProvider = 'deepseek'

export const AI_PROVIDERS: Record<AiProvider, AiProviderConfig> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    label: 'DeepSeek',
    buildUrl: (prompt: string) => `https://chat.deepseek.com/?q=${encodeURIComponent(prompt)}`,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    label: 'Gemini',
    buildUrl: (prompt: string) => `https://gemini.google.com/app?prompt=${encodeURIComponent(prompt)}`,
  },
}

export const AI_PROVIDER_EVENT = 'orange:ai-provider-change' as const

export interface AiProviderEventDetail {
  provider: AiProvider
}

export function isAiProvider(value: unknown): value is AiProvider {
  return value === 'deepseek' || value === 'gemini'
}

/** 读取当前偏好的 AI 提供商，默认返回 deepseek */
export function getAiProvider(): AiProvider {
  if (typeof window === 'undefined') return DEFAULT_AI_PROVIDER
  try {
    const stored = localStorage.getItem('ai-explain-provider')
    if (isAiProvider(stored)) return stored
  } catch {
    // 隐私模式降级
  }
  return DEFAULT_AI_PROVIDER
}

/** 设置 AI 提供商并持久化与派发广播事件 */
export function setAiProvider(provider: AiProvider): AiProvider {
  const target = isAiProvider(provider) ? provider : DEFAULT_AI_PROVIDER
  try {
    localStorage.setItem('ai-explain-provider', target)
  } catch {
    // 隐私模式降级
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<AiProviderEventDetail>(AI_PROVIDER_EVENT, {
        detail: { provider: target },
      }),
    )
  }
  return target
}

export interface BuildAiPromptOptions {
  articleTitle?: string
  headings: string[]
}

/** 组合 AI 解释提示词 */
export function buildAiExplainPrompt({
  articleTitle,
  headings,
}: BuildAiPromptOptions): string {
  const cleanHeadings = headings.map((h) => h.trim()).filter(Boolean)
  if (cleanHeadings.length === 0) {
    if (articleTitle) {
      return `请帮我详细解释《${articleTitle}》这篇文章的核心主旨、关键概念与主要脉络。用通俗直白的语言进行系统讲解。`
    }
    return `请帮我详细解释这些内容的核心概念与关键原理。`
  }

  const titlePrefix = articleTitle ? `在文章《${articleTitle}》中，` : ''

  if (cleanHeadings.length === 1) {
    return (
      `请帮我详细解释${titlePrefix}关于「${cleanHeadings[0]}」的内容：\n` +
      `1. 它的核心概念与基本原理是什么？\n` +
      `2. 在实际开发/应用中有哪些典型场景或代码示例？\n` +
      `3. 有哪些容易混淆的误区或设计考量？\n` +
      `请用专业、通俗、直白的语言讲解。`
    )
  }

  const list = cleanHeadings.map((h, i) => `${i + 1}. ${h}`).join('\n')
  return (
    `请帮我详细解释${titlePrefix}以下几个章节/主题的内容：\n` +
    `${list}\n\n` +
    `请按如下要求解答：\n` +
    `1. 分别讲解各章节的核心原理与关键知识点；\n` +
    `2. 说明这些章节/概念之间的内在联系与逻辑递进关系；\n` +
    `3. 用通俗直白、专业简洁的语言进行阐述，可配合实际场景或示例说明。`
  )
}

/** 根据提供商构建网页 URL */
export function buildAiUrl(provider: AiProvider, prompt: string): string {
  const config = AI_PROVIDERS[provider] || AI_PROVIDERS[DEFAULT_AI_PROVIDER]
  return config.buildUrl(prompt)
}

/**
 * 复制 Prompt 到剪贴板并在新标签页中打开对应 AI
 * @returns 是否成功写入剪贴板
 */
export async function explainWithAi(
  prompt: string,
  provider: AiProvider = getAiProvider(),
): Promise<boolean> {
  let copied = false
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(prompt)
      copied = true
    } catch {
      copied = false
    }
  }

  if (typeof window !== 'undefined') {
    const url = buildAiUrl(provider, prompt)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return copied
}
