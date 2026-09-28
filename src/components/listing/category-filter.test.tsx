// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { aggregateCategories, CategorySidebar, filterPillClass } from '@/components/listing/category-filter'

afterEach(() => {
  cleanup()
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

describe('CategorySidebar 正常渲染', () => {
  function Harness() {
    const [active, setActive] = useState<string | null>(null)
    return (
      <CategorySidebar
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
 * 移动端分类条契约（用户反馈：不是整宽横滑，而是把整页撑出横向滚动）：
 * 滚动容器必须是「整宽出血的 ul」本身；aside 只负责出血背景与吸顶，且 min-w-0 不被内容撑宽。
 * 药丸 shrink-0，否则 flex 会先压胶囊再谈滚动。
 */
describe('CategorySidebar 移动端横滑布局', () => {
  function renderSidebar() {
    return render(
      <CategorySidebar
        categories={[
          { name: 'css', count: 2 },
          { name: 'meta', count: 1 },
        ]}
        active={null}
        onSelect={() => {}}
        navLabel="文章分类"
      />,
    )
  }

  it('滚动发生在 ul 上：宽度等于视口、内部横滑，而不是溢出到整页', () => {
    const { container } = renderSidebar()
    const list = container.querySelector('ul')

    expect(list?.className).toContain('overflow-x-auto')
    // 出血由 aside 承担，ul 只补内边距让胶囊与正文左缘对齐（再叠一层负边距会多溢出 16px）
    expect(list?.className).toContain('px-4')
    expect(list?.className).not.toMatch(/(^|\s)-mx-4(\s|$)/)
    expect(list?.className).toContain('overscroll-x-contain')
  })

  it('aside 出血但不带内边距（内边距只由滚动容器提供，避免两层留白）', () => {
    const { container } = renderSidebar()
    const aside = container.querySelector('aside')

    expect(aside?.className).toContain('-mx-4')
    expect(aside?.className, 'aside 不该再叠一层 px-4').not.toMatch(/(^|\s)px-4(\s|$)/)
    expect(aside?.className, '网格项默认 min-width:auto，会被内容撑宽').toContain('min-w-0')
  })
  it('吸顶位置跟随 --header-height，不写死 top-14', () => {
    const { container } = renderSidebar()
    const aside = container.querySelector('aside')

    expect(aside?.className).toContain('top-[var(--header-height)]')
    expect(aside?.className).not.toMatch(/top-14/)
  })

  it('药丸不参与压缩', () => {
    renderSidebar()
    expect(screen.getByRole('button', { name: '最近' }).className).toContain('shrink-0')
  })
})
