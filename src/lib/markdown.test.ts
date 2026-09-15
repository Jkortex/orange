import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderServerComponent } from '@/components/test-utils/render-server'
import { MarkdownRenderer } from '@/lib/markdown'

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

  it('remark-directive 自定义块映射为组件（:::note）', async () => {
    const html = await renderToHtml(':::note\n提示内容\n:::')

    expect(html).toContain('data-callout="note"')
    expect(html).toContain('提示内容')
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
})
