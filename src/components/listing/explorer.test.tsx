// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Explorer } from '@/components/listing/explorer'

afterEach(() => {
  cleanup()
})

afterEach(() => {
  cleanup()
})

type Item = { key: string; label: string; category?: string }

const POST_ROW = 'list-row group flex items-center gap-3'

function renderRow(item: Item) {
  return <span>{item.label}</span>
}

const items: Item[] = [
  { key: 'a', label: '甲', category: 'x' },
  { key: 'b', label: '乙', category: 'y' },
  { key: 'c', label: '丙', category: 'x' },
]

function renderExplorer(props?: Partial<React.ComponentProps<typeof Explorer<Item>>>) {
  return render(
    <Explorer<Item>
      items={items}
      navLabel="测试分类"
      emptyMessage="空空如也。"
      unit="篇"
      getKey={(item) => item.key}
      rowClassName={POST_ROW}
      renderItem={renderRow}
      {...props}
    />,
  )
}

describe('Explorer 正常渲染', () => {
  it('分类过滤 + 行 slot 渲染 + 计数单位', () => {
    renderExplorer()
    expect(screen.getByRole('heading', { name: '全部' })).toBeTruthy()
    expect(screen.getByText('共 3 篇')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'x 2' }))
    expect(screen.getByRole('heading', { name: 'x' })).toBeTruthy()
    expect(screen.getByText('甲')).toBeTruthy()
    expect(screen.getByText('丙')).toBeTruthy()
    expect(screen.queryByText('乙')).toBeNull()
  })

  it('无 pageSize 时全量展示、无加载更多', () => {
    renderExplorer()
    // 行内容全量在场（侧栏 li 同为 listitem 角色，故按行文案断言）
    expect(screen.getByText('甲')).toBeTruthy()
    expect(screen.getByText('乙')).toBeTruthy()
    expect(screen.getByText('丙')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /加载更多/ })).toBeNull()
  })

  it('pageSize 启用分批加载与到底文案', () => {
    renderExplorer({ pageSize: 2, allShownText: (n) => `到底啦 ${n}` })
    expect(screen.getByText('甲')).toBeTruthy()
    expect(screen.getByText('乙')).toBeTruthy()
    expect(screen.queryByText('丙')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /加载更多/ }))
    expect(screen.getByText('丙')).toBeTruthy()
    expect(screen.getByText('到底啦 3')).toBeTruthy()
  })
})

describe('Explorer 异常渲染', () => {
  it('空集合：空态文案 + 计数归零', () => {
    renderExplorer({ items: [] })
    expect(screen.getByText('空空如也。')).toBeTruthy()
    expect(screen.getByText('共 0 篇')).toBeTruthy()
  })

  /*
   * 分类只有 1 个时，过滤器没有选择余地（技能页目前只有 workflow 一个分类）：
   * 与其给一个只能选「全部/那一个」的死控件，不如整条隐藏并让列表占满宽度。
   */
  it('分类 ≤1 时隐藏过滤器，列表单列占满', () => {
    const { container } = renderExplorer({
      items: [
        { key: 'a', label: '甲', category: 'only' },
        { key: 'b', label: '乙', category: 'only' },
      ],
    })

    expect(screen.queryByRole('button', { name: '测试分类' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: '测试分类' })).toBeNull()

    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('md:grid-cols-1')
    expect(grid.className).not.toContain('10rem')
  })

  it('分类 ≥2 时过滤器照常渲染并保留侧栏栅格', () => {
    const { container } = renderExplorer()

    expect(screen.getByRole('navigation', { name: '测试分类' })).toBeTruthy()
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('md:grid-cols-[10rem_minmax(0,1fr)]')
  })
})
