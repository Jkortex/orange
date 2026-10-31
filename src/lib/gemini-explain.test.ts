import { describe, expect, it } from 'vitest'
import {
  buildGeminiExplainPrompt,
  buildGeminiUrl,
} from './gemini-explain'

describe('buildGeminiExplainPrompt', () => {
  it('单标题 + 存在文章标题', () => {
    const prompt = buildGeminiExplainPrompt({
      articleTitle: '分布式系统架构实战',
      headings: ['CAP 定理与一致性级别'],
    })

    expect(prompt).toContain('分布式系统架构实战')
    expect(prompt).toContain('CAP 定理与一致性级别')
    expect(prompt).toContain('核心概念与基本原理')
  })

  it('多标题 + 存在文章标题', () => {
    const prompt = buildGeminiExplainPrompt({
      articleTitle: 'Rust 可观测性全解',
      headings: ['指标采集', '分布式追踪', '日志关联分析'],
    })

    expect(prompt).toContain('Rust 可观测性全解')
    expect(prompt).toContain('1. 指标采集')
    expect(prompt).toContain('2. 分布式追踪')
    expect(prompt).toContain('3. 日志关联分析')
    expect(prompt).toContain('内在联系与逻辑递进关系')
  })

  it('无文章标题时兜底', () => {
    const prompt = buildGeminiExplainPrompt({
      headings: ['数据结构平衡树'],
    })

    expect(prompt).toContain('数据结构平衡树')
    expect(prompt).not.toContain('《》')
  })

  it('空标题列表时兜底', () => {
    const prompt = buildGeminiExplainPrompt({
      articleTitle: '测试文章',
      headings: [],
    })

    expect(prompt).toContain('测试文章')
    expect(prompt).toContain('核心主旨')
  })
})

describe('buildGeminiUrl', () => {
  it('正确拼接 Gemini 网址并对 prompt 做 URI 编码', () => {
    const url = buildGeminiUrl('解释 CAP 定理')
    expect(url).toBe('https://gemini.google.com/app?prompt=%E8%A7%A3%E9%87%8A%20CAP%20%E5%AE%9A%E7%90%86')
  })
})
