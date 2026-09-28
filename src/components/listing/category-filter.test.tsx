// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { aggregateCategories, CategoryFilter, filterPillClass } from '@/components/listing/category-filter'
import { stubBrowserApis, unstubBrowserApis } from '@/components/test-utils/stub-browser-apis'

beforeEach(() => {
  // Popover 的 floating-ui autoUpdate 需要 ResizeObserver
  stubBrowserApis()
})

afterEach(() => {
  cleanup()
  unstubBrowserApis()
})

describe('aggregateCategories', () => {
  it('聚合条数并按名称排序，无分类条目跳过', () => {
    const items = [
      { category: 'css' },
      { category: 'meta' },
      { category: 'css' },
      {},
    ]
    expect(aggregateCategories(items)).toEqual([
      { name: 'css', count: 2 },
      { name: 'meta', count: 1 },
    ])
  })

  it('空集合返回空数组', () => {
    expect(aggregateCategories([])).toEqual([])
  })
})

describe('filterPillClass', () => {
  it('active 与默认态可区分', () => {
    expect(filterPillClass(true)).toContain('text-primary')
    expect(filterPillClass(false)).toContain('text-muted-foreground')
  })

  it('桌面端拉满侧栏宽度（计数才能右对齐成列）', () => {
    expect(filterPillClass(true)).toContain('md:w-full')
    expect(filterPillClass(false)).toContain('md:w-full')
  })

  it('桌面端改用行形状圆角（全宽胶囊会读成一颗大按钮）', () => {
    expect(filterPillClass(false)).toContain('md:rounded-lg')
  })

  it('桌面端选中态用可见边框表达（全宽行 + 行圆角）', () => {
    const on = filterPillClass(true)
    expect(on, '选中行须有可见边框').toContain('border-primary/50')
    expect(on, '桌面端不填充底色，靠边框区分').toContain('md:bg-transparent')
  })

  it('默认态边框透明：桌面端两侧仅靠边框有无区分', () => {
    expect(filterPillClass(false)).toContain('border-transparent')
  })

  it('已废弃左侧竖条方案（不留死代码）', () => {
    const on = filterPillClass(true)
    expect(on).not.toContain('before:bg-primary')
    expect(on).not.toContain('before:content')
  })
})

describe('CategoryFilter 正常渲染', () => {
  function Harness() {
    const [active, setActive] = useState<string | null>(null)
    return (
      <CategoryFilter
        categories={[
          { name: 'css', count: 2 },
          { name: 'meta', count: 1 },
        ]}
        active={active}
        onSelect={setActive}
        navLabel="文章分类"
      />
    )
  }

  it('渲染「最近」与分类（含条数），默认最近激活', () => {
    render(<Harness />)
    expect(screen.getByRole('navigation', { name: '文章分类' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '最近' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'css 2' })).toBeTruthy()
  })

  it('点击分类回调用选中名', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'meta 1' }))
    expect(screen.getByRole('button', { name: 'meta 1' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '最近' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('计数跟随选中态颜色（不写死），且桌面端右对齐', () => {
    render(<Harness />)
    const count = screen.getByRole('button', { name: 'css 2' }).querySelector('span')
    expect(count?.className, '计数写死颜色会导致 active 时仍是灰的').not.toContain('text-muted-foreground')
    expect(count?.className, '桌面端计数须右对齐').toContain('md:ml-auto')
  })
})

/*
 * 移动端分类控件（用户反馈：横滑药丸条读不出「还有更多」）：
 * 收起时只是一行 36px 的下拉按钮（显示当前分类），点开后在下方浮层里
 * 用可换行的药丸网格把所有分类一次摊开——没有横向滚动，也不把页面撑长。
 * 桌面端（md 起）仍是原来的纵向吸顶侧栏。
 */
describe('CategoryFilter 移动端下拉筛选', () => {
  function renderSidebar(active: string | null = null) {
    return render(
      <CategoryFilter
        categories={[
          { name: 'css', count: 2 },
          { name: 'meta', count: 1 },
        ]}
        active={active}
        onSelect={() => {}}
        navLabel="文章分类"
      />,
    )
  }

  it('收起状态只有一行下拉按钮，显示当前分类', () => {
    renderSidebar('css')

    const trigger = screen.getByRole('button', { name: '分类筛选：css' })
    expect(trigger).toBeTruthy()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.className).toContain('h-9')
  })

  it('点开后浮层里是可换行的药丸网格，横向不再滚动', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: '分类筛选：最近' }))

    const panel = await screen.findByRole('dialog')
    const grid = panel.querySelector('[data-category-grid]')
    expect(grid?.className).toContain('flex-wrap')
    expect(grid?.className).not.toContain('overflow-x-auto')

    for (const name of ['最近', 'css 2', 'meta 1']) {
      expect(within(panel).getByRole('button', { name })).toBeTruthy()
    }
  })

  it('浮层里的分类药丸带条数，并标出当前选中项', async () => {
    renderSidebar('css')

    fireEvent.click(screen.getByRole('button', { name: '分类筛选：css' }))

    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByRole('button', { name: 'css 2' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(panel).getByRole('button', { name: '最近' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('移动端不再有横滑药丸条；桌面侧栏整块隐藏到 md 起', () => {
    const { container } = renderSidebar()

    const aside = container.querySelector('aside')?.className ?? ''
    expect(aside).toContain('hidden')
    expect(aside).toContain('md:block')
    expect(container.querySelector('ul')?.className ?? '').not.toContain('overflow-x-auto')
  })

  it('吸顶位置跟随 --header-height（不再是横滑条的 top-14）', () => {
    const { container } = renderSidebar()

    expect(container.innerHTML).toContain('top-[var(--header-height)]')
  })
})
