// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SearchResultsList } from '@/components/chrome/search/search-results-list'
import {
  SEARCH_LISTBOX_ID,
  searchOptionId,
  type SearchGroup,
  type UnifiedSearchItem,
} from '@/components/chrome/search/types'

// 高亮项会被滚入视口，jsdom 未实现 scrollIntoView（与 scroll.test 同一套桩法）
const scrollIntoView = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>()
window.HTMLElement.prototype.scrollIntoView = scrollIntoView

beforeEach(() => {
  scrollIntoView.mockClear()
})

afterEach(() => {
  cleanup()
})

function item(overrides: Partial<UnifiedSearchItem> & { id: string }): UnifiedSearchItem {
  return {
    kind: 'post',
    title: overrides.id,
    onSelect: vi.fn(),
    ...overrides,
  }
}

const groups: SearchGroup[] = [
  {
    id: 'group-posts',
    label: '文章与内容',
    items: [
      item({ id: 'p1', title: 'CSS Grid 指南', url: '/posts/grid', excerpt: '用 <mark>grid</mark> 布局' }),
      item({ id: 'p2', title: '发布记录', url: '/posts/deploy', badge: '生活' }),
    ],
  },
  {
    id: 'group-outlines',
    label: '本文小节大纲',
    items: [
      item({ id: 'o1', kind: 'outline', title: '流程图技术选型', subtitle: '页面小节 (H2)', badge: 'H2' }),
    ],
  },
]

function renderList(selectedIndex = -1, onSelect = vi.fn()) {
  render(<SearchResultsList groups={groups} selectedIndex={selectedIndex} onSelect={onSelect} />)
  return { onSelect, listbox: screen.getByRole('listbox', { name: '搜索结果' }) }
}

describe('SearchResultsList 渲染', () => {
  it('向读屏软件暴露 listbox → group → option 三层结构', () => {
    const { listbox } = renderList()

    expect(listbox.id).toBe(SEARCH_LISTBOX_ID)
    expect(within(listbox).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      '文章与内容',
      '本文小节大纲',
    ])
    expect(within(listbox).getAllByRole('option')).toHaveLength(3)
  })

  it('分组标题带条目数，便于判断哪一组有命中', () => {
    const { listbox } = renderList()

    expect(within(listbox).getByText('文章与内容 (2)')).toBeTruthy()
    expect(within(listbox).getByText('本文小节大纲 (1)')).toBeTruthy()
  })

  it('空分组整组不渲染，不留一个只有标题的空壳', () => {
    render(
      <SearchResultsList
        groups={[{ id: 'empty', label: '空分组', items: [] }, ...groups.slice(0, 1)]}
        selectedIndex={-1}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByText(/空分组/)).toBeNull()
  })

  it('有 url 的条目是链接，无 url 的条目退化为按钮', () => {
    const { listbox } = renderList()

    const link = within(listbox).getByText('CSS Grid 指南').closest('a')
    expect(link?.getAttribute('href')).toBe('/posts/grid')
    expect(within(listbox).getByText('流程图技术选型').closest('button')).toBeTruthy()
  })

  it('excerpt 里的命中标记按 HTML 渲染；无 excerpt 时退回 subtitle', () => {
    const { listbox } = renderList()

    expect(within(listbox).getByText('grid').tagName).toBe('MARK')
    expect(within(listbox).getByText('页面小节 (H2)')).toBeTruthy()
  })

  it('条目徽标按索引元数据渲染，缺失时不占位', () => {
    const { listbox } = renderList()

    expect(within(listbox).getByText('生活')).toBeTruthy()
    expect(within(listbox).getByText('H2')).toBeTruthy()
  })
})

describe('SearchResultsList 高亮与选择', () => {
  it('未导航时没有选中项', () => {
    const { listbox } = renderList()

    for (const option of within(listbox).getAllByRole('option')) {
      expect(option.getAttribute('aria-selected')).toBe('false')
    }
  })

  it('扁平索引跨分组连续：索引 2 落在第二组的第一项上', () => {
    const { listbox } = renderList(2)

    const options = within(listbox).getAllByRole('option')
    expect(options.map((o) => o.id)).toEqual([
      searchOptionId(0),
      searchOptionId(1),
      searchOptionId(2),
    ])
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true'])
    // 高亮项同时给视觉反馈，不只靠 aria
    expect(within(listbox).getByText('流程图技术选型').closest('button')?.className).toContain(
      'bg-primary/10',
    )
  })

  it('高亮项变化时滚入视口，长列表里键盘导航不会跑出视野', () => {
    renderList(1)

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('点击链接不触发浏览器跳转，统一交给 onSelect（内部走 router）', () => {
    const { onSelect, listbox } = renderList()
    const link = within(listbox).getByText('CSS Grid 指南').closest('a')!

    const notPrevented = fireEvent.click(link)

    expect(notPrevented).toBe(false) // preventDefault 已调用
    expect(onSelect).toHaveBeenCalledWith(groups[0].items[0])
  })

  it('点击按钮型条目同样回调 onSelect', () => {
    const { onSelect, listbox } = renderList()

    fireEvent.click(within(listbox).getByText('流程图技术选型').closest('button')!)

    expect(onSelect).toHaveBeenCalledWith(groups[1].items[0])
  })
})
