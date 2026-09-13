import { describe, expect, it } from 'vitest'
import { extractToc, shouldShowToc, slugifyHeading, TOC_MIN_HEADINGS } from './toc'

// 目录提取：纯函数，输入 markdown 原文，输出与渲染管线一致的锚点 id
//（slug 规则与 rehype 标题 id 插件同源，见 toc.ts）
describe('slugifyHeading 正常', () => {
  it('中英文保留，空格转连字符', () => {
    expect(slugifyHeading('渲染管线的 设计取舍')).toBe('渲染管线的-设计取舍')
    expect(slugifyHeading('Hello World')).toBe('hello-world')
  })

  it('去除行内装饰符号，合并多余连字符', () => {
    expect(slugifyHeading('**加粗** 与 `代码`')).toBe('加粗-与-代码')
    expect(slugifyHeading('a   b__c')).toBe('a-b-c')
  })

  it('纯符号标题回退为 section', () => {
    expect(slugifyHeading('***')).toBe('section')
    expect(slugifyHeading('')).toBe('section')
  })
})

describe('extractToc 正常提取', () => {
  it('收录二级/三级标题，忽略一级与四级', () => {
    const toc = extractToc('# 文章标题\n\n## 结论\n\n### 细节\n\n#### 太深\n\n正文')

    expect(toc).toEqual([
      { depth: 2, text: '结论', id: '结论' },
      { depth: 3, text: '细节', id: '细节' },
    ])
  })

  it('闭合式 ATX 标题去掉尾部 #', () => {
    const toc = extractToc('## 结论 ##\n')

    expect(toc).toEqual([{ depth: 2, text: '结论', id: '结论' }])
  })

  it('重复标题自动加后缀，与渲染管线一致', () => {
    const toc = extractToc('## 方法\n\n## 方法\n\n## 方法\n')

    expect(toc.map((h) => h.id)).toEqual(['方法', '方法-1', '方法-2'])
  })

  it('围栏代码块内的 # 行不算标题', () => {
    const toc = extractToc('## 真标题\n\n```md\n## 假标题\n```\n')

    expect(toc).toEqual([{ depth: 2, text: '真标题', id: '真标题' }])
  })
})

describe('extractToc 异常边界', () => {
  it('空输入返回空数组', () => {
    expect(extractToc('')).toEqual([])
    expect(extractToc('只有正文，没有标题')).toEqual([])
  })

  it('无闭合围栏时剩余行仍按标题解析（不抛错）', () => {
    expect(() => extractToc('## 标题\n\n```\n## 另一个\n')).not.toThrow()
  })
})

describe('shouldShowToc 长文阈值', () => {
  it(`标题数达到 ${TOC_MIN_HEADINGS} 才显示目录`, () => {
    expect(shouldShowToc('## 一\n\n## 二\n')).toBe(false)
    expect(shouldShowToc('## 一\n\n## 二\n\n## 三\n')).toBe(true)
    expect(shouldShowToc('')).toBe(false)
  })
})
