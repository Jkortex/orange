import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/*
 * @theme inline 把语义 token 映射为 Tailwind 工具类（bg-surface / shadow-card / rounded-card ...）。
 * 漏映射 = 工具类不存在，组件静默失去样式；本测试守住映射表。
 */
const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')

const themeBlock = (() => {
  const start = css.indexOf('@theme inline')
  if (start === -1) throw new Error('缺少 @theme inline 块')
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
})()

const MAPPINGS = [
  '--color-surface: var(--surface)',
  '--color-surface-hover: var(--surface-hover)',
  '--color-border-subtle: var(--border-subtle)',
  '--color-border-strong: var(--border-strong)',
  // 主题层用 --elevation-*，避免与 Tailwind 自有的 --shadow-* 命名空间自引用
  '--shadow-card: var(--elevation-card)',
  '--shadow-pop: var(--elevation-pop)',
  '--shadow-overlay: var(--elevation-overlay)',
  '--shadow-bar: var(--elevation-bar)',
  '--radius-card: 0.75rem',
]

describe('globals.css @theme 映射', () => {
  it.each(MAPPINGS)('映射 %s', (mapping) => {
    expect(themeBlock).toContain(mapping)
  })
})

/*
 * 回归守卫（真实踩过的坑）：
 * .list-row 的常驻描边由自身控制，分隔线必须写在自身（border-top）。
 * 若父级再加 divide-*：divide-* 落在 utilities 层，CSS 层优先级高于 components 层
 * （层优先级压过选择器特异性），会覆盖 .list-row 的 border-color: transparent，
 * 导致除最后一行外每行常驻描边。
 */
const SRC = fileURLToPath(new URL('..', import.meta.url))

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === 'test-utils') continue
      collectSourceFiles(full, out)
    } else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.(tsx|ts)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const sourceFiles = [...collectSourceFiles(`${SRC}/components`), ...collectSourceFiles(`${SRC}/app`)]
const DIVIDE = /\bdivide-[a-z]/

describe('.list-row 分隔线契约', () => {
  it('components 层内 .list-row 自带 border-top 分隔线', () => {
    const componentsLayer = css.slice(css.indexOf('@layer components'))
    expect(componentsLayer).toMatch(/\.list-row\s*\{[^}]*border-top/)
  })

  it('任何文件都不同时出现 list-row 与 divide-*', () => {
    const offenders = sourceFiles.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.includes('list-row') && DIVIDE.test(source)
    })
    expect(offenders, `list-row 与 divide-* 混用：${offenders.join(', ')}`).toEqual([])
  })

  it('共享列表容器 Explorer 不叠加 divide-*', () => {
    const explorer = readFileSync(`${SRC}/components/listing/explorer.tsx`, 'utf8')
    expect(DIVIDE.test(explorer)).toBe(false)
  })
})

/*
 * 形状契约（用户反馈的真实观感问题）：
 * 1. 只显示 border-top 的盒子一旦带圆角，分隔线两端会向下弯成"假圆角"，看着像瑕疵而不是有意为之。
 * 2. 悬停底色与上下 border 的横向范围必须一致——底色若画在另行外扩的伪元素上，就会超出分隔线两端。
 *    底色画在行盒上（background-clip: border-box）时「行盒 = 底色 = 描边」恒等，从机制上排除该问题。
 * 3. 首行 border-top 兼作表头下方的分隔线、末行 border-bottom 收口，列表才是闭合表格。
 */
function listRowRuleBodies(): string[] {
  const componentsLayer = css.slice(css.indexOf('@layer components'))
  return [...componentsLayer.matchAll(/\.list-row[^{]*\{([^}]*)\}/g)].map((m) => m[1])
}

function componentsLayer(): string {
  return css.slice(css.indexOf('@layer components'))
}

describe('.list-row 形状契约', () => {
  it('规则内不得出现圆角（分隔线须两端平直）', () => {
    const offenders = listRowRuleBodies().filter((body) => body.includes('border-radius'))
    expect(offenders, `list-row 规则含圆角：${offenders.join(' | ')}`).toEqual([])
  })

  it('悬停底色直接画在行盒上，与 border 同宽', () => {
    const hoverRule = componentsLayer().match(/\.list-row:hover\s*\{([^}]*)\}/)
    expect(hoverRule?.[1] ?? '', '悬停必须设置 background-color').toContain('background-color')
  })

  it('悬停底色不得画在会另行外扩的伪元素上（否则底色会超出 border）', () => {
    expect(componentsLayer()).not.toMatch(/\.list-row[^{]*::(before|after)/)
  })

  it('横向内边距与负边距成对出现（文字内缩留白，同时行盒外扩让分隔线跟随）', () => {
    const body = listRowRuleBodies().find((b) => b.includes('padding')) ?? ''
    expect(body, '行盒需要内边距给文字留白').toMatch(/padding:\s*[\d.]+rem/)
    expect(body, '内边距必须配等量负边距，否则文字会与表头错位').toMatch(/margin-inline:\s*-/)
  })

  it('首行 border-top 兼作表头分隔线，末行 border-bottom 收口', () => {
    const bodies = listRowRuleBodies().join('\n')
    expect(bodies).toContain('border-top')
    expect(bodies).toContain('border-bottom')
  })

  it('不得再抑制首行 border-top（那会让表头下方缺一条分隔线）', () => {
    expect(componentsLayer()).not.toMatch(/\.list-row:first-child/)
  })
})
