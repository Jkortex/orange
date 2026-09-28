// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { SearchDialog } from '@/components/chrome/search-dialog'
import { OPEN_SEARCH_EVENT } from '@/lib/search-events'
import { loadPagefind, type PagefindApi } from '@/lib/pagefind'

vi.mock('@/lib/pagefind', () => ({ loadPagefind: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))
const mockLoad = vi.mocked(loadPagefind)
const mockUseRouter = vi.mocked(useRouter)
const mockPush = vi.fn()

// Radix 弹窗外部点击监听处理
async function flushRadixListeners() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

beforeEach(() => {
  mockLoad.mockReset()
  mockPush.mockReset()
  mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>)
})

const makeApi = (searchImpl: ReturnType<typeof vi.fn>): PagefindApi =>
  ({ search: searchImpl }) as unknown as PagefindApi

describe('SearchDialog 统一智能搜索正常渲染', () => {
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

  it('响应生活页的打开事件并切换到生活范围', () => {
    render(<SearchDialog />)

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_SEARCH_EVENT, { detail: { scope: 'life' } }),
      )
    })

    expect(screen.getByRole('dialog', { name: '站内搜索' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '生活' }).getAttribute('aria-selected')).toBe('true')
  })

  it('展示直观的分类过滤胶囊（全部 / 文章 / 技能 / 生活 / 音乐）', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.getByRole('tab', { name: '全部' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '文章' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '技能' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '生活' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '音乐' })).toBeTruthy()
  })

  it('空状态：展示常用推荐动作与最近访问记录', () => {
    localStorage.setItem(
      'orange_recent_visits',
      JSON.stringify([{ url: '/posts/hello', title: '你好 Orange' }]),
    )

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.getByText('最近访问')).toBeTruthy()
    expect(screen.getByText('你好 Orange')).toBeTruthy()
    expect(screen.getByText('常用推荐')).toBeTruthy()
    expect(screen.getByText('切换深色 / 浅色模式')).toBeTruthy()
  })

  it('空状态：支持一键清空最近访问记录', () => {
    localStorage.setItem(
      'orange_recent_visits',
      JSON.stringify([{ url: '/posts/hello', title: '你好 Orange' }]),
    )

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const clearBtn = screen.getByRole('button', { name: '清除记录' })
    fireEvent.click(clearBtn)

    expect(screen.queryByText('你好 Orange')).toBeNull()
    expect(localStorage.getItem('orange_recent_visits')).toBeNull()
  })

  it('输入关键词全文检索：渲染文章结果分组与命中高亮', async () => {
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
    const input = screen.getByLabelText('搜索关键词')
    fireEvent.change(input, { target: { value: 'grid' } })

    await waitFor(() => {
      expect(screen.getByText('文章与内容 (1)')).toBeTruthy()
      expect(screen.getByText('CSS Grid 指南')).toBeTruthy()
    })

    const dialog = screen.getByRole('dialog', { name: '站内搜索' })
    const mark = dialog.querySelector('mark')
    expect(mark?.textContent).toBe('grid')
  })

  it('自然匹配快捷动作：输入“主题”即可直达切换深浅模式', async () => {
    mockLoad.mockResolvedValue(makeApi(vi.fn().mockResolvedValue({ results: [] })))

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByLabelText('搜索关键词')
    fireEvent.change(input, { target: { value: '主题' } })

    await waitFor(() => {
      expect(screen.getByText('快捷操作 (1)')).toBeTruthy()
      expect(screen.getByText('切换深色 / 浅色模式')).toBeTruthy()
    })
  })

  it('自然匹配分类：输入“CSS”即可直达 CSS 分类专栏', async () => {
    mockLoad.mockResolvedValue(makeApi(vi.fn().mockResolvedValue({ results: [] })))

    render(<SearchDialog categories={[{ name: 'css', count: 2 }]} />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByLabelText('搜索关键词')
    fireEvent.change(input, { target: { value: 'CSS' } })

    await waitFor(() => {
      expect(screen.getByText(/分类与专栏/)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('link', { name: /CSS/ }))
    expect(mockPush).toHaveBeenCalledWith('/category/css')
  })

  it('自然匹配本文章节大纲：输入章节标题直达对应锚点', async () => {
    const heading = document.createElement('h2')
    heading.id = 'sec-diagram-overview'
    heading.textContent = '流程图技术选型'
    document.body.appendChild(heading)

    mockLoad.mockResolvedValue(makeApi(vi.fn().mockResolvedValue({ results: [] })))

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByLabelText('搜索关键词')
    fireEvent.change(input, { target: { value: '技术选型' } })

    const dialog = screen.getByRole('dialog', { name: '站内搜索' })
    await waitFor(() => {
      expect(screen.getByText('本文小节大纲 (1)')).toBeTruthy()
      expect(within(dialog).getByText('流程图技术选型')).toBeTruthy()
    })

    document.body.removeChild(heading)
  })

  it('Tab 键不被搜索框劫持，保留默认焦点顺序', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const input = screen.getByLabelText('搜索关键词')
    expect(screen.getByRole('tab', { name: '全部' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(input, { key: 'Tab' })

    expect(screen.getByRole('tab', { name: '全部' }).getAttribute('aria-selected')).toBe('true')
  })

  it('方向键 ↑↓ 在跨分组结果间平滑循环高亮，回车触发执行', async () => {
    mockLoad.mockResolvedValue(
      makeApi(
        vi.fn().mockResolvedValue({
          results: [
            {
              data: async () => ({
                url: '/posts/css-demo',
                meta: { title: 'CSS 演示' },
                excerpt: '演示内容',
              }),
            },
          ],
        }),
      ),
    )

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByLabelText('搜索关键词')
    fireEvent.change(input, { target: { value: 'CSS' } })

    await waitFor(() => {
      expect(screen.getByText('CSS 演示')).toBeTruthy()
    })

    // 按下方向键选择条目
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const item = screen.getByText('CSS 演示').closest('a')
    expect(item?.className).toContain('bg-primary/10')

    // 按 Enter 键执行打开并关闭对话框
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockPush).toHaveBeenCalledWith('/posts/css-demo')
  })

  it('点击关闭按钮或 Esc 或遮罩能正常关闭', async () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    // 再次打开并按关闭按钮
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: '关闭搜索' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    // 再次打开并点遮罩
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await flushRadixListeners()
    fireEvent.pointerDown(screen.getByTestId('search-backdrop'))
    fireEvent.click(screen.getByTestId('search-backdrop'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('SearchDialog 异常渲染', () => {
  it('索引不可用：友好显示构建提示文案', async () => {
    mockLoad.mockResolvedValue(null)
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'react' } })

    await waitFor(() => {
      expect(screen.getByText('搜索索引不可用，请先完成构建。')).toBeTruthy()
    })
  })

  it('检索出错：友好显示错误文案', async () => {
    mockLoad.mockResolvedValue(makeApi(vi.fn().mockRejectedValue(new Error('fail'))))
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'error-query' } })

    await waitFor(() => {
      expect(screen.getByText('搜索出错，请稍后再试。')).toBeTruthy()
    })
  })
})
