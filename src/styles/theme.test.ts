import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * 主题 token 纪律（AGENTS.md 主题规范第 2 条）：
 * 新增语义变量必须写进「每一套主题」的 light + dark 块，否则组件会取到空值而静默失效。
 * 本测试是守卫：漏写任一块都会在此变红。
 */
const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')

const REQUIRED_TOKENS = [
  '--surface',
  '--surface-hover',
  '--border-subtle',
  '--border-strong',
  '--elevation-card',
  '--elevation-pop',
  '--elevation-overlay',
  '--elevation-bar',
]

// 选择器带上 '{' 以区分 light/dark（dark 选择器是 light 选择器的前缀，不加 '{' 会误命中）
const THEME_BLOCKS = [
  { name: 'default · light', selector: ":root[data-theme='default'] {" },
  { name: 'default · dark', selector: ":root[data-theme='default'].dark {" },
  { name: 'catppuccin · light', selector: ":root[data-theme='catppuccin'] {" },
  { name: 'catppuccin · dark', selector: ":root[data-theme='catppuccin'].dark {" },
]

function blockBody(selector: string): string {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`缺少主题块：${selector}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('主题 token 一致性', () => {
  it.each(THEME_BLOCKS)('$name 定义了全部新增语义 token', ({ selector }) => {
    const body = blockBody(selector)
    for (const token of REQUIRED_TOKENS) {
      expect(body, `${selector} 缺少 ${token}`).toContain(`${token}:`)
    }
  })

  it('两套主题 × 两种模式共四个块都存在', () => {
    for (const { selector } of THEME_BLOCKS) {
      expect(() => blockBody(selector), selector).not.toThrow()
    }
  })

  /*
   * 系统不变量：--surface 必须与 --background 不同色。
   * 桌面端 .list-row:hover 与 .surface-interactive:hover 都用 --surface 做提亮、
   * surface-card 用 --surface 做卡片底色；一旦两者同值，hover 就没有可见反馈，
   * 卡片轮廓也只剩一根描边。catppuccin·light 曾把 base(#eff1f5) 复制给 surface，即此病。
   */
  it.each(THEME_BLOCKS)('$name 的 --surface 与 --background 不同色', ({ selector }) => {
    const body = blockBody(selector)
    const read = (token: string) => {
      const m = body.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))
      if (!m) throw new Error(`${selector} 缺少 ${token}`)
      return m[1].trim().toLowerCase().replace(/\s+/g, ' ')
    }
    expect(read('--surface'), `${selector}：--surface 不能等于 --background`).not.toBe(
      read('--background'),
    )
  })
})
