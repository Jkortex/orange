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

  it('移动端不占满视口：保留基类的左右留白，仅 sm 起放宽到 max-w-xl', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const dialog = screen.getByRole('dialog', { name: '站内搜索' })
    expect(dialog.className, '移动端须保留 100%-2rem 的左右留白').toContain('max-w-[calc(100%-2rem)]')
    expect(dialog.className, 'sm 起才放宽到 max-w-xl').toContain('sm:max-w-xl')
    expect(dialog.className.split(' ')).not.toContain('max-w-xl')
  })

  it('响应生活页的打开事件并切换到生活范围', () => {
    render(<SearchDialog />)

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_SEARCH_EVENT, { detail: { scope: 'life' } }),
      )
    })

    expect(screen.getByRole('dialog', { name: '站内搜索' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '生活' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('展示直观的分类过滤胶囊（全部 / 文章 / 技能 / 生活 / 音乐）', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.getByRole('button', { name: '全部' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '文章' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '技能' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '生活' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '音乐' })).toBeTruthy()
  })

  it('范围胶囊是过滤开关（aria-pressed）而非 tab，无 tabpanel 缺失', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const group = screen.getByRole('group', { name: '搜索范围过滤' })
    expect(within(group).getByRole('button', { name: '全部' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(group).getByRole('button', { name: '文章' }).getAttribute('aria-pressed')).toBe('false')
  })

  /*
   * 空态刻意留白：搜索只负责检索内容。
   * 原来这里塞过「常用推荐」（切换深浅色 / 前往首页 / 前往文章列表）与「最近访问」，
   * 前者在顶栏已有一等公民入口、后者是本地历史，两者都不是内容检索的结果，故整体移除。
   */
  it('空态只留检索提示，不推荐动作也不列历史', () => {
    localStorage.setItem(
      'orange_recent_visits',
      JSON.stringify([{ url: '/posts/hello', title: '你好 Orange' }]),
    )

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.getByText(/输入关键词/)).toBeTruthy()
    expect(screen.queryByText('常用推荐')).toBeNull()
    expect(screen.queryByText('最近访问')).toBeNull()
    expect(screen.queryByText('你好 Orange')).toBeNull()
    expect(screen.queryByRole('button', { name: '清除记录' })).toBeNull()
  })

  // 触屏上不存在物理键盘，↑↓/Tab/ESC 提示纯属占位，整条底栏 sm 起才显示
  it('快捷键底栏默认隐藏，仅 sm 起显示', () => {
    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const bar = screen.getByText('ESC 关闭').closest('div')
    expect(bar?.className).toContain('hidden')
    expect(bar?.className).toContain('sm:flex')
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

  it('全部范围不向索引下推 filter，只传关键词', async () => {
    const search = vi.fn().mockResolvedValue({ results: [] })
    mockLoad.mockResolvedValue(makeApi(search))

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'grid' } })

    await waitFor(() => expect(search).toHaveBeenCalled())
    expect(search.mock.calls[0]).toEqual(['grid'])
  })

  it('选择范围后把过滤条件下推给 Pagefind 索引（不再全量取回再前端筛）', async () => {
    const search = vi.fn().mockResolvedValue({ results: [] })
    mockLoad.mockResolvedValue(makeApi(search))

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: '技能' }))
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'tdd' } })

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('tdd', { filters: { type: ['skills'] } })
    })
  })

  it('输入后切换范围会带上新过滤条件重新检索', async () => {
    const search = vi.fn().mockResolvedValue({ results: [] })
    mockLoad.mockResolvedValue(makeApi(search))

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'tea' } })
    await waitFor(() => expect(search).toHaveBeenCalledWith('tea'))

    fireEvent.click(screen.getByRole('button', { name: '生活' }))

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('tea', { filters: { type: ['life'] } })
    })
  })

  it('结果徽标优先用 Pagefind 过滤元数据判定类型，而非猜 URL 前缀', async () => {
    mockLoad.mockResolvedValue(
      makeApi(
        vi.fn().mockResolvedValue({
          results: [
            {
              data: async () => ({
                url: '/posts/deploy-note',
                meta: { title: '发布记录' },
                filters: { type: ['life'] },
              }),
            },
          ],
        }),
      ),
    )

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: '发布' } })

    const listbox = await screen.findByRole('listbox', { name: '搜索结果' })
    expect(within(listbox).getByText('发布记录')).toBeTruthy()
    expect(within(listbox).getByText('生活')).toBeTruthy()
  })

  it('栏目页没有类型元数据时不给徽标，不硬塞「文章」', async () => {
    mockLoad.mockResolvedValue(
      makeApi(
        vi.fn().mockResolvedValue({
          results: [
            {
              data: async () => ({
                url: '/music',
                meta: { title: '曲谱合集' },
                filters: {},
              }),
            },
          ],
        }),
      ),
    )

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: '曲谱' } })

    const listbox = await screen.findByRole('listbox', { name: '搜索结果' })
    expect(within(listbox).getByText('曲谱合集')).toBeTruthy()
    expect(within(listbox).queryByText('文章')).toBeNull()
  })

  it('输入框是 combobox：结果以 listbox/option 暴露，高亮项通过 aria-activedescendant 关联', async () => {
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

    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-activedescendant')).toBeNull()

    fireEvent.change(input, { target: { value: 'grid' } })
    const listbox = await screen.findByRole('listbox', { name: '搜索结果' })
    const option = within(listbox).getAllByRole('option')[0]

    await waitFor(() => expect(input.getAttribute('aria-expanded')).toBe('true'))
    expect(input.getAttribute('aria-controls')).toBe(listbox.id)
    expect(option.getAttribute('aria-selected')).toBe('false')

    fireEvent.keyDown(input, { key: 'ArrowDown' })

    expect(option.getAttribute('aria-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(option.id)
  })

  /*
   * 搜索已收敛为纯内容检索：系统动作与分类直达两组结果整体下线，
   * 输入「主题」「CSS」不应再产生任何导航型结果。
   */
  it('纯内容检索：系统动作与分类直达不再作为结果出现', async () => {
    mockLoad.mockResolvedValue(makeApi(vi.fn().mockResolvedValue({ results: [] })))

    render(<SearchDialog />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByLabelText('搜索关键词')
    fireEvent.change(input, { target: { value: '主题' } })

    await waitFor(() => {
      expect(screen.getByText(/未找到与/)).toBeTruthy()
    })
    expect(screen.queryByText(/快捷操作/)).toBeNull()
    expect(screen.queryByText(/分类与专栏/)).toBeNull()
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
    expect(screen.getByRole('button', { name: '全部' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.keyDown(input, { key: 'Tab' })

    expect(screen.getByRole('button', { name: '全部' }).getAttribute('aria-pressed')).toBe('true')
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
