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
})
