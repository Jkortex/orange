// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SearchDialog } from './search-dialog'
import { loadPagefind, type PagefindApi } from '@/lib/pagefind'

vi.mock('@/lib/pagefind', () => ({ loadPagefind: vi.fn() }))
const mockLoad = vi.mocked(loadPagefind)

// Radix 把 document pointerdown 监听放在 setTimeout(0) 里挂载（见 theme-select 迁移），
// 外部交互类断言前需放行一个 macrotask
async function flushRadixListeners() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  mockLoad.mockReset()
})

// 测试桩：Mock 函数与真实 API 签名结构兼容，仅需断言宽化
const makeApi = (searchImpl: ReturnType<typeof vi.fn>): PagefindApi =>
  ({ search: searchImpl }) as unknown as PagefindApi

describe('SearchDialog 正常渲染', () => {
  it('顶栏渲染搜索图标按钮（aria-label=搜索，无常驻文字）', () => {
    render(<SearchDialog />)

    const btn = screen.getByRole('button', { name: '搜索' })
    expect(btn.getAttribute('aria-keyshortcuts')).toContain('Control+K')
  })

  it('Ctrl+K 打开对话框并聚焦输入框', () => {
    render(<SearchDialog />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const dialog = screen.getByRole('dialog', { name: '站内搜索' })
    expect(dialog).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('搜索关键词'))
  })

  it('再次 Ctrl+K 关闭对话框', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Esc 关闭对话框', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    // Radix 在 document（capture）监听 Escape；真机按键目标是文档内元素，必经此路径
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('输入关键词渲染结果：标题链接指向内容页，摘要保留高亮标记', async () => {
    mockLoad.mockResolvedValue(
      makeApi(
        vi.fn().mockResolvedValue({
          results: [
            {
              data: async () => ({
                url: '/posts/2026-09-01-css-grid',
                meta: { title: 'CSS Grid 指南' },
                excerpt: '使用 <mark>grid</mark> 布局的要点',
              }),
            },
          ],
        }),
      ),
    )
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'grid' } })

    await waitFor(() => {
      // 链接可及名 = 标题 + 摘要全文，按子串匹配标题
      expect(screen.getByRole('link', { name: /CSS Grid 指南/ })).toBeTruthy()
    })
    const link = screen.getByRole('link', { name: /CSS Grid 指南/ }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/posts/2026-09-01-css-grid')
    // excerpt 按富文本渲染：<mark> 为真实元素而非转义文本
    const dialog = screen.getByRole('dialog', { name: '站内搜索' })
    const mark = dialog.querySelector('mark')
    expect(mark?.textContent).toBe('grid')
  })

  it('清空关键词回到提示态', async () => {
    mockLoad.mockResolvedValue(
      makeApi(
        vi.fn().mockResolvedValue({
          results: [
            {
              data: async () => ({
                url: '/posts/2026-09-01-css-grid',
                meta: { title: 'CSS Grid 指南' },
                excerpt: '',
              }),
            },
          ],
        }),
      ),
    )
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByLabelText('搜索关键词') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'grid' } })
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /CSS Grid 指南/ })).toBeTruthy()
    })

    fireEvent.change(input, { target: { value: '' } })

    expect(screen.getByText('输入关键词搜索全站内容。')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('关闭再开保留上次关键词与结果（规格 §6.3）', async () => {
    mockLoad.mockResolvedValue(
      makeApi(
        vi.fn().mockResolvedValue({
          results: [
            {
              data: async () => ({
                url: '/posts/2026-09-01-css-grid',
                meta: { title: 'CSS Grid 指南' },
                excerpt: '摘要',
              }),
            },
          ],
        }),
      ),
    )
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'grid' } })
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /CSS Grid 指南/ })).toBeTruthy()
    })

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByLabelText('搜索关键词')).toHaveProperty('value', 'grid')
    expect(screen.getByRole('link', { name: /CSS Grid 指南/ })).toBeTruthy()
  })

  it('点击关闭按钮关闭对话框', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: '关闭搜索' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('点击遮罩关闭对话框', async () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await flushRadixListeners()

    // 真实点按序列：pointerdown 触发 Radix 外部 dismissal，随后的 click 完成交互
    fireEvent.pointerDown(screen.getByTestId('search-backdrop'))
    fireEvent.click(screen.getByTestId('search-backdrop'))

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('SearchDialog 异常渲染', () => {
  it('索引不可用：显示提示文案', async () => {
    mockLoad.mockResolvedValue(null)
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'grid' } })

    await waitFor(() => {
      expect(screen.getByText('搜索索引不可用，请先完成构建。')).toBeTruthy()
    })
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('无搜索结果：显示空态提示', async () => {
    mockLoad.mockResolvedValue(makeApi(vi.fn().mockResolvedValue({ results: [] })))
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: '不存在' } })

    await waitFor(() => {
      expect(screen.getByText('没有找到相关内容。')).toBeTruthy()
    })
  })

  it('搜索执行出错：显示错误提示', async () => {
    mockLoad.mockResolvedValue(makeApi(vi.fn().mockRejectedValue(new Error('boom'))))
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'grid' } })

    await waitFor(() => {
      expect(screen.getByText('搜索出错，请稍后再试。')).toBeTruthy()
    })
  })
})
