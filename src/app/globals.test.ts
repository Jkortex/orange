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
 * .list-row 契约（用户反馈的真实观感问题）：
 * 列表行 = 通直满宽的分隔线 + 竖向内缩的圆角悬停高亮。二者分属两个盒，互不破坏：
 * 分隔线是行盒自身的 border-top（末行 border-bottom 收口），高亮是行盒内的圆角伪元素。
 * 为什么必须解耦：只画上边框的盒子一旦加圆角，分隔线两端会向下弯成"假圆角"，
 * 看着像瑕疵——圆角只能给高亮，不能给行盒（踩过的坑，勿回退）。
 * 高亮竖向内缩是为了与上下分隔线留缝，否则圆角会顶到直线；
 * 高亮用 z-index: -1 落在行内容之下，故行盒须 isolation: isolate 建立层叠上下文，
 * 否则负 z-index 会掉到页面底色之下而不可见。
 * 行盒不得自带圆角，也不得与父级 divide-* 混用——divide-* 落在 utilities 层，
 * 层优先级高于 components 层，会覆盖行样式。
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

function componentsLayer(): string {
  return css.slice(css.indexOf('@layer components'))
}

describe('.list-row 契约', () => {
  it('行盒自带通直分隔线（首行 border-top，末行 border-bottom 收口）', () => {
    expect(ruleBody('.list-row')).toContain('border-top')
    expect(ruleBody('.list-row:last-child')).toContain('border-bottom')
  })

  it('行盒自身不带圆角（圆角会让分隔线两端弯成假圆角）', () => {
    expect(ruleBody('.list-row')).not.toContain('border-radius')
  })

  it('悬停高亮是竖向内缩的圆角伪元素（与分隔线解耦）', () => {
    const before = ruleBody('.list-row::before')
    expect(before, '高亮须带圆角').toContain('border-radius')
    expect(before, '高亮须竖向内缩，否则圆角会顶到分隔线').toMatch(/inset:\s*[\d.]+rem\s+0/)
    expect(before, '高亮须落在行内容之下').toContain('z-index: -1')
  })

  it('悬停时给高亮上底色', () => {
    expect(ruleBody('.list-row:hover::before')).toContain('background-color')
  })

  it('行盒建立层叠上下文（高亮 z-index:-1 才不会掉到页面底色之下）', () => {
    expect(ruleBody('.list-row')).toContain('isolation: isolate')
  })

  it('横向内边距与负边距成对出现（文字内缩留白，高亮与分隔线同宽）', () => {
    const body = ruleBody('.list-row')
    expect(body, '行盒需要内边距给文字留白').toMatch(/padding:\s*[\d.]+rem/)
    expect(body, '内边距必须配等量负边距，否则文字会与表头错位').toMatch(/margin-inline:\s*-/)
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

  it('为 Pagefind 标记正文边界，避免索引全局 chrome', () => {
    const layout = readFileSync(`${SRC}/app/layout.tsx`, 'utf8')
    expect(layout).toMatch(/<main[^>]*data-pagefind-body/)
  })

  it('全站正文统一使用 HarmonyOS Sans，不再引入衬线字体', () => {
    const layout = readFileSync(`${SRC}/app/layout.tsx`, 'utf8')
    const entryView = readFileSync(`${SRC}/components/listing/entry-view.tsx`, 'utf8')
    const skillView = readFileSync(`${SRC}/components/listing/skill-package-view.tsx`, 'utf8')

    expect(layout).not.toContain('lxgw-wenkai-webfont')
    expect(entryView).not.toContain('ProseFontLink')
    expect(skillView).not.toContain('ProseFontLink')
    expect(css).toContain('font-family: var(--font-sans);')
    expect(css).not.toContain('--font-serif')
    expect(css).not.toContain('LXGW WenKai')
  })
})

/*
 * 移动端 chrome 契约（真实反馈：顶栏文字挤在一行、分类条把整页撑出横向滚动）：
 * 1. 顶栏高度只有一个来源 --header-height（移动端两行导航，sm 起一行）；
 *    sticky 偏移与锚点避让都必须跟着它走，写死 top-14 / top-20 会随布局漂移。
 * 2. 横向滚动只允许发生在「整宽出血 + overflow-x-auto」的容器内部；
 *    body 用 overflow-x: clip 兜底（clip 不建立滚动容器，不影响 sticky）。
 */
describe('移动端 chrome 契约', () => {
  const layout = readFileSync(`${SRC}/app/layout.tsx`, 'utf8')
  const baseLayer = css.slice(css.indexOf('@layer base'), css.indexOf('@layer components'))

  it('--header-height 在 base 层定义，并在 sm 断点重新声明（顶栏单行，两断点各自留白不同）', () => {
    expect(baseLayer).toMatch(/--header-height:\s*[\d.]+rem/)
    const smBlock = baseLayer.match(/@media \(min-width: 40rem\)[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(smBlock, 'sm 起内边距更大，必须重新声明高度').toMatch(/--header-height:\s*[\d.]+rem/)
  })

  it('顶栏保持单行：移动端靠抽屉收纳栏目，而不是把顶栏撑成多行', () => {
    expect(layout).toMatch(/min-h-\[var\(--header-height\)\]/)
    expect(layout, '顶栏不再需要 flex-wrap 两行布局').not.toMatch(/flex-wrap/)
    expect(layout).toContain('<MobileNavDrawer')
    expect(layout).toMatch(/hidden sm:block/)
  })

  it('锚点跳转避让高度跟随顶栏变量', () => {
    expect(baseLayer).toMatch(/scroll-margin-top:\s*calc\(var\(--header-height\)/)
  })

  it('整页不会出现横向滚动：body 用 clip 兜底（不用 hidden，避免破坏 sticky）', () => {
    expect(baseLayer).toMatch(/overflow-x:\s*clip/)
    // 只看声明，注释里提到 hidden 不算
    const declarations = baseLayer.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toMatch(/overflow-x:\s*hidden/)
  })

  it('组件里不再出现写死的 sticky 偏移（top-0 的顶栏本身除外）', () => {
    const offenders = sourceFiles.filter((file) =>
      /sticky[^\n]*\btop-(?!0\b)\d/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders, `sticky 偏移必须用 var(--header-height)：${offenders.join(', ')}`).toEqual([])
  })
})

/*
 * 配方收敛守卫（AGENTS.md 表面系统）：
 * 小标签 / 键位 / 媒体框 / 浮动卡片各自收敛为唯一配方，
 * 组件不再手写「圆角 × 底色 × 描边」的散装组合（此前 chip 有 6 套、媒体框有 5 套写法）。
 * 静态卡片 .surface-card 必须保持平坦——高度只属于真正浮起的 .surface-float。
 */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = componentsLayer().match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`缺少配方：${selector}`)
  return match[1]
}

describe('配方收敛守卫', () => {
  it('.chip 是唯一小标签配方（胶囊 + 描边 + 中性底）', () => {
    const body = ruleBody('.chip')
    expect(body).toContain('border-radius: 999px')
    expect(body).toContain('border: 1px solid var(--border-subtle)')
    expect(body).toContain('background-color: var(--muted)')
  })

  it('.chip-quiet 仅去掉底色（保留描边）', () => {
    expect(ruleBody('.chip-quiet')).toContain('background-color: transparent')
  })

  it('.chip-subtle 是普通标签的低重量变体，保留可交互反馈', () => {
    const body = ruleBody('.chip-subtle')
    expect(body).toContain('border-color: transparent')
    expect(body).toContain('background-color: transparent')
    expect(ruleBody('.chip-subtle:hover')).toContain('background-color: var(--muted)')
  })

  it('.chip-interactive 悬停转品牌色', () => {
    expect(ruleBody('.chip-interactive:hover')).toContain('color: var(--primary)')
  })

  it('.kbd 使用等宽字体', () => {
    expect(ruleBody('.kbd')).toContain('font-family: var(--font-mono)')
  })

  it('.media-frame 统一卡片圆角与中性底', () => {
    const body = ruleBody('.media-frame')
    expect(body).toContain('border-radius: var(--radius-card)')
    expect(body).toContain('background-color: var(--muted)')
  })

  it('.surface-float 是唯一带高度的卡片配方，取 --elevation-card', () => {
    expect(ruleBody('.surface-float')).toContain('box-shadow: var(--elevation-card)')
  })

  it('.surface-card 保持平坦（高度只属于浮动层）', () => {
    expect(ruleBody('.surface-card')).not.toContain('box-shadow')
  })

  it('.panel-bar 是面板内次级栏的唯一底色', () => {
    expect(ruleBody('.panel-bar')).toContain(
      'background-color: color-mix(in oklab, var(--muted) 40%, transparent)',
    )
  })
})
