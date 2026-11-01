// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  buildAiExplainPrompt,
  buildAiUrl,
  explainWithAi,
  getAiProvider,
  setAiProvider,
  type AiProvider,
} from './ai-explain'

describe('ai-explain module', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(window, 'open').mockImplementation(() => null)
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('默认 AI Provider 为 deepseek', () => {
    expect(DEFAULT_AI_PROVIDER).toBe('deepseek')
    expect(getAiProvider()).toBe('deepseek')
  })

  it('setAiProvider 支持持久化与读取切换 (deepseek <-> gemini)', () => {
    expect(setAiProvider('gemini')).toBe('gemini')
    expect(getAiProvider()).toBe('gemini')
    expect(localStorage.getItem('ai-explain-provider')).toBe('gemini')

    expect(setAiProvider('deepseek')).toBe('deepseek')
    expect(getAiProvider()).toBe('deepseek')
    expect(localStorage.getItem('ai-explain-provider')).toBe('deepseek')
  })

  it('localStorage 中为非法值时回退到 deepseek', () => {
    localStorage.setItem('ai-explain-provider', 'unknown-provider')
    expect(getAiProvider()).toBe('deepseek')
  })

  it('buildAiUrl 正确构建 DeepSeek 与 Gemini 的跳转链接', () => {
    const prompt = '解释 CAP 定理'
    const deepseekUrl = buildAiUrl('deepseek', prompt)
    const geminiUrl = buildAiUrl('gemini', prompt)

    expect(deepseekUrl).toContain('https://chat.deepseek.com/?q=')
    expect(deepseekUrl).toContain(encodeURIComponent(prompt))

    expect(geminiUrl).toContain('https://gemini.google.com/app?prompt=')
    expect(geminiUrl).toContain(encodeURIComponent(prompt))
  })

  it('explainWithAi 复制 prompt 到剪贴板并在新标签页打开对应 AI', async () => {
    const prompt = '测试提示词'
    const copied = await explainWithAi(prompt, 'deepseek')

    expect(copied).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(prompt)
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('https://chat.deepseek.com/?q='),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('buildAiExplainPrompt 组合高质量小节解释 Prompt', () => {
    const single = buildAiExplainPrompt({
      articleTitle: '分布式系统架构',
      headings: ['一致性与共识'],
    })
    expect(single).toContain('分布式系统架构')
    expect(single).toContain('一致性与共识')

    const multi = buildAiExplainPrompt({
      articleTitle: '分布式系统架构',
      headings: ['主从复制', '分片分区'],
    })
    expect(multi).toContain('1. 主从复制')
    expect(multi).toContain('2. 分片分区')
    expect(multi).toContain('内在联系与逻辑递进关系')
  })
})
