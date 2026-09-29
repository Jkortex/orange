// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MobileNavDrawer } from '@/components/chrome/mobile-nav-drawer'

let currentPath = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}))

afterEach(() => {
  cleanup()
  currentPath = '/'
})

async function openDrawer() {
  render(<MobileNavDrawer />)
  fireEvent.click(screen.getByRole('button', { name: '菜单' }))
  // Radix 弹层异步挂载，等一个 tick
  await screen.findByRole('dialog')
}

describe('MobileNavDrawer 顶栏菜单', () => {
  it('触发器是图标按钮，带可及名且触摸目标 ≥36px', () => {
    render(<MobileNavDrawer />)

    const trigger = screen.getByRole('button', { name: '菜单' })
    expect(trigger.className).toContain('size-9')
    // 图标化按钮必须只在移动端出现，sm 起由顶栏行内导航接管
    expect(trigger.className).toContain('sm:hidden')
  })

  it('打开后逐行列出全部栏目（每项独占一行，不再挤在一行里）', async () => {
    await openDrawer()

    for (const name of ['文章', '生活', '音乐', '技能']) {
      expect(screen.getByRole('link', { name })).toBeTruthy()
    }
    // 竖排列表：每一项都是块级行，行高足够点按
    const row = screen.getByRole('link', { name: '文章' })
    expect(row.className).toContain('w-full')
    expect(row.className).toContain('py-3')
  })

  it('抽屉有可及名，当前栏目标记 aria-current', async () => {
    currentPath = '/life'
    await openDrawer()

    const dialog = screen.getByRole('dialog', { name: '栏目导航' })
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('link', { name: '生活' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: '文章' }).getAttribute('aria-current')).toBeNull()
  })

  it('点击栏目后关闭抽屉（把「跳转」交给路由，弹层不留在屏幕上）', async () => {
    await openDrawer()

    fireEvent.click(screen.getByRole('link', { name: '音乐' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Esc 关闭抽屉', async () => {
    await openDrawer()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('抽屉里不再放第二个搜索入口（顶栏已有唯一搜索按钮）', async () => {
    await openDrawer()

    expect(screen.queryByRole('button', { name: '搜索' })).toBeNull()
  })

  it('打开后焦点落在第一个栏目，而不是关闭按钮', async () => {
    render(<MobileNavDrawer />)
    fireEvent.click(screen.getByRole('button', { name: '菜单' }))
    await screen.findByRole('dialog')

    // 关闭按钮在 DOM 末尾，浮层默认聚焦它；用户预期是「打开就能按第一个栏目」
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('link', { name: '文章' }))
    })
  })

  /*
   * SheetContent 自带的关闭钮没有内边距、图标 24px，触屏上按不中，
   * 故整颗换成自绘的 36px 圆钮（vendor 那颗已被 showCloseButton={false} 关掉）。
   */
  it('关闭钮是 36px 圆钮，且抽屉里只有这一颗', async () => {
    render(<MobileNavDrawer />)
    fireEvent.click(screen.getByRole('button', { name: '菜单' }))
    const dialog = await screen.findByRole('dialog')

    const closes = screen.getAllByRole('button', { name: '关闭菜单' })
    expect(closes).toHaveLength(1)
    expect(closes[0].className).toContain('size-9')

    // vendor 那颗带 sr-only「关闭」文案，不应存在
    expect(dialog.querySelector('.sr-only')?.textContent).not.toBe('关闭')
  })

  it('点击关闭钮收起抽屉', async () => {
    render(<MobileNavDrawer />)
    fireEvent.click(screen.getByRole('button', { name: '菜单' }))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByRole('button', { name: '关闭菜单' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
