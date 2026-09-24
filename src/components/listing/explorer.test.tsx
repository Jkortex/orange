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
    expect(screen.getByRole('heading', { name: '最近' })).toBeTruthy()
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
})
