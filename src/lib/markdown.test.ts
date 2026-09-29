import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderServerComponent } from '@/components/test-utils/render-server'
import { MarkdownRenderer } from '@/lib/markdown'
import { extractToc } from '@/lib/toc'

async function renderToHtml(markdown: string) {
  return renderServerComponent(h(MarkdownRenderer, { children: markdown }))
}

describe('MarkdownRenderer 正常渲染', () => {
  it('渲染标题与段落（标题带与目录一致的锚点 id）', async () => {
    const html = await renderToHtml('## 二级标题\n\n段落文本')

    expect(html).toContain('id="二级标题"')
    expect(html).toContain('二级标题')
    expect(html).toContain('aria-label="复制标题链接"')
    expect(html).toContain('<p>段落文本</p>')
  })

  it('支持 GFM：删除线与表格', async () => {
    const html = await renderToHtml('~~删除~~\n\n| a | b |\n| - | - |\n| 1 | 2 |')

    expect(html).toContain('<del>删除</del>')
    expect(html).toContain('<table>')
  })

  /*
   * 宽表在窄屏会被裁掉：表格自身 overflow: hidden（为圆角），body 又是 overflow-x: clip，
   * 触屏无从滚动。表格必须套一层 overflow-x-auto 容器，而这个 class 正是
   * a11y-scrollable 用来补 tabindex 的选择器。
   */
  it('表格套横向滚动容器，窄屏不会被裁且可键盘聚焦', async () => {
    const html = await renderToHtml(
      '| 一 | 二 | 三 | 四 | 五 |\n| - | - | - | - | - |\n| 1 | 2 | 3 | 4 | 5 |',
    )

    expect(html).toMatch(/<div class="overflow-x-auto"><table>/)
    expect(html).toContain('</table></div>')
  })

  it('remark-directive 自定义块映射为组件（:::note）', async () => {
    const html = await renderToHtml(':::note\n提示内容\n:::')

    expect(html).toContain('data-callout="note"')
    expect(html).toContain('提示内容')
  })

  it(':::demo 指令转换为 CodeDemo 组件与 iframe 沙箱', async () => {
    const md = [
      ':::demo[卡片测试]',
      '',
      '```html',
      '<div class="card">Hello</div>',
      '```',
      '',
      '```css',
      '.card { color: red; }',
      '```',
      '',
      ':::',
    ].join('\n')

    const html = await renderToHtml(md)

    expect(html).toContain('卡片测试')
    expect(html).toContain('<iframe')
    expect(html).toContain('.card { color: red; }')
  })

  it('代码块构建时高亮（Shiki dual theme）', async () => {
    const html = await renderToHtml('```ts\nconst a = 1\n```')

    expect(html).toContain('data-language="ts"')
    // dual theme：light/dark 变量内联在节点上，随主题 CSS 切换
    expect(html).toContain('--shiki-light')
    expect(html).toContain('--shiki-dark')
  })

  it('行内代码不受 style 转换影响', async () => {
    const html = await renderToHtml('行内 `const x = 1` 代码')

    expect(html).toContain('<code>const x = 1</code>')
    expect(html).not.toContain('style=')
  })

  it('重复标题的锚点 id 自动加后缀，与 extractToc 一致', async () => {
    const html = await renderToHtml('## 方法\n\n## 方法\n')

    expect(html).toContain('id="方法"')
    expect(html).toContain('id="方法-1"')
  })

  it('一级/四级标题不产出目录锚点（只二级/三级带 id）', async () => {
    const html = await renderToHtml('# 一级\n\n#### 四级\n')

    expect(html).not.toContain('id=')
  })

  it('含有类似 :is() 或 :where() 的标题正常渲染且锚点与 toc 一致', async () => {
    const md = '## 案例一：:is() 简化\n\n## 案例二：组件用 :where() 覆盖\n\n正文使用 ::before 伪元素'
    const html = await renderToHtml(md)

    expect(html).toContain('案例一：:is() 简化')
    expect(html).toContain('id="案例一is-简化"')
    expect(html).toContain('案例二：组件用 :where() 覆盖')
    expect(html).toContain('id="案例二组件用-where-覆盖"')
    expect(html).toContain('::before')
  })

  it('文章包含 :is() 和 :where() 时，渲染产物的所有标题 id 与 extractToc 100% 一致', async () => {
    const md = [
      '## 概述',
      '## 案例一：:is() 简化多选择器',
      '## 案例二：组件用 :where()，外部轻松覆盖',
      '## 案例三：外部用 :is() 批量覆盖组件',
      '## 总结',
    ].join('\n\n')

    const toc = extractToc(md)
    const html = await renderToHtml(md)

    expect(toc).toHaveLength(5)
    for (const item of toc) {
      expect(html).toContain(`id="${item.id}"`)
      expect(html).toContain(`<span>${item.text}</span>`)
    }
  })

  it('支持 mermaid 流程图代码块渲染为 SVG', async () => {
    const md = [
      '```mermaid',
      'graph TD',
      '  A[客户端] --> B[网关]',
      '  B --> C[微服务]',
      '```',
    ].join('\n')

    const html = await renderToHtml(md)

    expect(html).toContain('data-testid="mermaid-diagram"')
    expect(html).toContain('<svg')
    expect(html).toContain('客户端')
    expect(html).toContain('微服务')
    expect(html).toContain('var(--primary)')
  })

  /*
   * 正文图片外包一层「放大查看」触发按钮：按钮的 aria-label 是唯一无障碍名（内层 alt 不会被读两遍），
   * aria-haspopup="dialog" 让辅助技术预告会弹出对话框。
   */
  it('正文图片包在放大查看触发按钮里，带无障碍名与 dialog 预告', async () => {
    const html = await renderToHtml('![云原生架构示意图](/media/architecture/system-architecture.svg)')

    expect(html).toContain('aria-label="查看大图：云原生架构示意图"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('src="/media/architecture/system-architecture.svg"')
    expect(html).toContain('alt="云原生架构示意图"')
    // 触发按钮必须是真按钮，否则键盘无法打开
    expect(html).toContain('<button type="button"')
  })

  it('正文图片默认懒加载与异步解码', async () => {
    const html = await renderToHtml('![图](/a.png)')

    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
  })

  it('图片缺少 alt 时回落到通用文案，且 img 不残留 undefined', async () => {
    const html = await renderToHtml('![](/a.png)')

    expect(html).toContain('aria-label="查看大图：图片"')
    expect(html).toContain('alt=""')
    expect(html).not.toContain('undefined')
  })

  it('正文图片不下传 react-markdown 的 hast 节点（不出现 node 属性）', async () => {
    const html = await renderToHtml('![图](/a.png)')

    expect(html).not.toContain('node=')
    expect(html).not.toContain('[object Object]')
  })
})

describe('MarkdownRenderer 异常渲染', () => {
  it('空字符串渲染为空容器，不抛错', async () => {
    const html = await renderToHtml('')

    expect(html).not.toContain('<p>')
    expect(html).not.toContain('<h1>')
  })

  it('未闭合语法不抛错，按纯文本渲染', async () => {
    const html = await renderToHtml('[unclosed](link')

    expect(html).toContain('unclosed')
  })

  it('超长输入正常渲染', async () => {
    const long = Array.from({ length: 300 }, (_, i) => `段落${i}`).join('\n\n')
    const html = await renderToHtml(long)

    expect(html.match(/<p>/g)?.length).toBeGreaterThanOrEqual(300)
  })

  it('语法非法的 mermaid 代码块不崩溃，降级为普通代码展示', async () => {
    const md = [
      '```mermaid',
      'invalid mermaid syntax !!!',
      '```',
    ].join('\n')

    const html = await renderToHtml(md)
    expect(html).toContain('invalid mermaid syntax !!!')
  })
})
