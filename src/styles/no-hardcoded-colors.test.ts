import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/*
 * AGENTS.md 主题规范第 1 条：组件只允许语义 token，禁止硬编码颜色。
 * 本测试是纪律守卫：任何组件新增裸色值（调色板工具类 / hex / rgb / hsl / oklch）都会在此变红。
 * 颜色只允许出现在 src/styles/theme.css（唯一主题变量所在地）。
 */
const SRC = fileURLToPath(new URL('..', import.meta.url))

// 沙箱 iframe 的 srcDoc 需自带最小样式（与主文档隔离，拿不到语义 token）
const ALLOWLIST = new Set(['code-demo.tsx'])

const PALETTE =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone'
const COLOR_PATTERN = new RegExp(
  `(?:bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|divide|shadow|caret|accent)-(?:${PALETTE})-\\d{2,3}\\b` +
    `|#[0-9a-fA-F]{3,8}\\b` +
    // 前置 (?<![a-zA-Z]) 而非 \b：Tailwind 任意值里 rgb( 常紧跟下划线（shadow-[...rgb(...)]）
    `|(?<![a-zA-Z])(?:rgb|rgba|hsl|hsla|oklch)\\(`,
)

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === 'test-utils') continue
      collectFiles(full, out)
    } else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.(tsx|ts)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const files = [
  ...collectFiles(`${SRC}/components`),
  ...collectFiles(`${SRC}/app`),
].filter((file) => !ALLOWLIST.has(file.split(/[\\/]/).pop() ?? ''))

describe('硬编码颜色守卫', () => {
  it('扫描到了组件文件（守卫自身有效）', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(files)('%s 不含硬编码颜色', (file) => {
    const source = readFileSync(file, 'utf8')
    const match = source.match(COLOR_PATTERN)
    expect(match?.[0] ?? null, `${file} 出现硬编码颜色：${match?.[0]}`).toBeNull()
  })
})
