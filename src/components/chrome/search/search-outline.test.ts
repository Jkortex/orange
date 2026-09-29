// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  filterOutlines,
  getOutlineItems,
  scanCurrentHeadings,
} from '@/components/chrome/search/search-outline'
import type { UnifiedSearchItem } from '@/components/chrome/search/types'

// jsdom 未实现 scrollIntoView，大纲跳转依赖它（与 scroll.test 同一套桩法）
const scrollIntoView = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>()
window.HTMLElement.prototype.scrollIntoView = scrollIntoView

beforeEach(() => {
  scrollIntoView.mockClear()
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function heading(tag: 'h2' | 'h3', id: string, text: string, container: HTMLElement = document.body) {
  const el = document.createElement(tag)
  // 空 id 表示「没有 id 属性」：选择器是 [id]，写 el.id = '' 会留下 id="" 仍被命中
  if (id) el.id = id
  el.textContent = text
  container.appendChild(el)
  return el
}

describe('scanCurrentHeadings', () => {
  it('没有 article 时扫描整页带 id 的 H2/H3，并按标签定层级', () => {
    heading('h2', '一', '第一节')
    heading('h3', '一-一', '第一节之一')
    heading('h2', '', '没有 id 的标题') // 选择器要求 [id]，应被跳过

    expect(scanCurrentHeadings()).toEqual([
      { id: '一', title: '第一节', depth: 2 },
      { id: '一-一', title: '第一节之一', depth: 3 },
    ])
  })

  it('存在 article 时只认正文内的标题，页眉页脚的同级标题不混进来', () => {
    const article = document.createElement('article')
    document.body.appendChild(article)

    heading('h2', '正文', '正文小节', article)
    heading('h2', '页脚', '页脚里的标题')

    expect(scanCurrentHeadings().map((item) => item.id)).toEqual(['正文'])
  })

  it('去掉标题文本前导的 # 与空白', () => {
    heading('h2', '锚点', '  ## 带井号的标题  ')

    expect(scanCurrentHeadings()[0].title).toBe('带井号的标题')
  })

  it('页面上没有标题时返回空数组', () => {
    expect(scanCurrentHeadings()).toEqual([])
  })
})

describe('getOutlineItems', () => {
  it('把标题转成 outline 条目：badge/subtitle 标出层级', () => {
    const items = getOutlineItems(
      [
        { id: '一', title: '第一节', depth: 2 },
        { id: '一-一', title: '第一节之一', depth: 3 },
      ],
      vi.fn(),
    )

    expect(items.map((item) => item.kind)).toEqual(['outline', 'outline'])
    expect(items.map((item) => item.id)).toEqual(['heading-一', 'heading-一-一'])
    expect(items.map((item) => item.badge)).toEqual(['H2', 'H3'])
    expect(items[1].subtitle).toBe('页面小节 (H3)')
  })

  it('选中时先关弹窗再跳到锚点，并临时高亮目标标题', () => {
    vi.useFakeTimers()
    const target = heading('h2', '结论', '结论')
    const onClose = vi.fn()

    getOutlineItems([{ id: '结论', title: '结论', depth: 2 }], onClose)[0].onSelect()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(window.location.hash).toBe('#%E7%BB%93%E8%AE%BA')
    expect(target.className).toContain('ring-2')

    // 高亮是临时的，2s 后自行撤掉，不在页面上留痕
    vi.advanceTimersByTime(2000)
    expect(target.className).not.toContain('ring-2')
  })

  it('锚点不存在时只关弹窗，不抛错也不改 hash', () => {
    const onClose = vi.fn()

    expect(() => getOutlineItems([{ id: '不存在', title: 'x', depth: 2 }], onClose)[0].onSelect()).not.toThrow()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('filterOutlines', () => {
  const outlines: UnifiedSearchItem[] = getOutlineItems(
    [
      { id: 'a', title: 'CSS Grid 布局', depth: 2 },
      { id: 'b', title: '数据库索引', depth: 2 },
    ],
    vi.fn(),
  )

  it('空查询原样返回全部（未输入时不应把大纲筛空）', () => {
    expect(filterOutlines(outlines, '')).toHaveLength(2)
    expect(filterOutlines(outlines, '   ')).toHaveLength(2)
  })

  it('按标题子串匹配，忽略大小写与首尾空白', () => {
    expect(filterOutlines(outlines, 'css').map((item) => item.id)).toEqual(['heading-a'])
    expect(filterOutlines(outlines, '  索引  ').map((item) => item.id)).toEqual(['heading-b'])
  })

  it('无匹配时返回空数组', () => {
    expect(filterOutlines(outlines, '不存在的词')).toEqual([])
  })
})
