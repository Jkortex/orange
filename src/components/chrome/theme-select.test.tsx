// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeSelect } from '@/components/chrome/theme-select'

afterEach(() => {
  cleanup()
  document.documentElement.dataset.theme = 'default'
  localStorage.clear()
  vi.restoreAllMocks()
})

function openMenu() {
  // Radix 以 pointerdown（鼠标/触摸统一）展开菜单，真机点按必先触发它；fireEvent.click 无前置 pointerdown，打不开。
  // 另注意：菜单打开后触发按钮被 aria-hidden（背景失活），引用必须在打开前拿到。
  const button = screen.getByRole('button', { name: '选择主题' })
  fireEvent.pointerDown(button)
  return { button, menu: screen.getByRole('menu', { name: '选择主题' }) }
}

// Radix 把 document pointerdown 监听放在 setTimeout(0) 里挂载，同步 fireEvent 时监听尚不存在；放行一个 macrotask
async function flushRadixListeners() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('ThemeSelect 正常渲染', () => {
  /*
   * 主题名走 CSS 而不是 state：data-theme 由 head 里的内联脚本在首帧前写好，
   * 而 state 要等 effect 才读到 —— 走 state 的话选了 Catppuccin 的人每次加载
   * 都会先看到「默认」再跳变。代价是两个标签同时在 DOM 里。
   */
  it('两个主题标签都在 DOM 里，各自带按 data-theme 切换的类', () => {
    render(<ThemeSelect />)

    const button = screen.getByRole('button', { name: '选择主题' })
    const labels = Array.from(button.querySelectorAll('[data-theme-label]'))

    expect(labels.map((el) => el.getAttribute('data-theme-label'))).toEqual(['default', 'catppuccin'])
    expect(labels.map((el) => el.textContent)).toEqual(['默认', 'Catppuccin'])

    // 每个标签都必须带对应主题的变体类，漏一个就会有一个主题名永远不显示
    for (const el of labels) {
      const id = el.getAttribute('data-theme-label')
      expect(el.className, `${id} 缺少 data-theme 变体类`).toContain(`data-theme='${id}'`)
    }
  })

  it('菜单默认关闭，且重复的标签不进无障碍名（名字仍是「选择主题」）', () => {
    render(<ThemeSelect />)

    const button = screen.getByRole('button', { name: '选择主题' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    // 文本是拼接串，但 aria-label 覆盖了它，读屏只会念「选择主题」
    expect(button.textContent).toBe('默认Catppuccin')
  })

  it('点击触发按钮展开菜单，含「默认」与「Catppuccin」两个可选项', () => {
    render(<ThemeSelect />)

    const { button, menu } = openMenu()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const items = within(menu).getAllByRole('menuitemradio')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('默认')
    expect(items[1].textContent).toBe('Catppuccin')
  })

  it('再次按触发按钮关闭菜单', () => {
    render(<ThemeSelect />)

    const { button } = openMenu()
    fireEvent.pointerDown(button)

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('菜单以非模态（modal=false）展开，不锁定背景与滚动', () => {
    render(<ThemeSelect />)

    const { button } = openMenu()
    expect(button.getAttribute('aria-hidden')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('ThemeSelect 交互', () => {
  it('选择 Catppuccin 后更新 data-theme 并持久化，菜单关闭', () => {
    render(<ThemeSelect />)

    fireEvent.click(within(openMenu().menu).getByRole('menuitemradio', { name: 'Catppuccin' }))

    expect(document.documentElement.dataset.theme).toBe('catppuccin')
    expect(localStorage.getItem('theme-name')).toBe('catppuccin')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('选中项带 check 图标（lucide-check）', () => {
    render(<ThemeSelect />)

    const { menu } = openMenu()
    const current = within(menu).getByRole('menuitemradio', { name: '默认' })
    expect(current.querySelector('.lucide-check')).not.toBeNull()
    expect(current.getAttribute('aria-checked')).toBe('true')
  })

  it('点击菜单外部关闭菜单', async () => {
    render(<ThemeSelect />)

    openMenu()
    await flushRadixListeners()
    // Radix 以 pointerdown 判定外部交互（鼠标/触摸统一）
    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('按 Escape 关闭菜单', () => {
    render(<ThemeSelect />)

    openMenu()
    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('ThemeSelect 异常渲染', () => {
  it('localStorage 不可用时选择主题不抛错，仅本次会话生效', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    render(<ThemeSelect />)

    expect(() =>
      fireEvent.click(within(openMenu().menu).getByRole('menuitemradio', { name: 'Catppuccin' })),
    ).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('catppuccin')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
