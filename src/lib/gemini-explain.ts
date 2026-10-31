/*
 * Gemini AI 章节解释辅助工具：
 * - 将选中的一个或复数个小节标题 + 文章标题，组合成结构专业、易于 AI 理解并深度解答的 Prompt
 * - 复制生成的提示词到剪贴板，并唤起 Gemini 网页应用 (gemini.google.com)
 */

export interface BuildGeminiPromptOptions {
  articleTitle?: string
  headings: string[]
}

/** 组合 Gemini 解释提示词 */
export function buildGeminiExplainPrompt({
  articleTitle,
  headings,
}: BuildGeminiPromptOptions): string {
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

/** 构造带有 prompt query 参数的 Gemini 访问 URL */
export function buildGeminiUrl(prompt: string): string {
  return `https://gemini.google.com/app?prompt=${encodeURIComponent(prompt)}`
}

/**
 * 复制 Prompt 到剪贴板并在新标签页中打开 Gemini
 * @returns 是否成功写入剪贴板
 */
export async function explainWithGemini(prompt: string): Promise<boolean> {
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
    const url = buildGeminiUrl(prompt)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return copied
}
