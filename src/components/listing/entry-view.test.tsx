import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderServerComponent } from '@/components/test-utils/render-server'
import { EntryView } from '@/components/listing/entry-view'
import type { CollectionEntry } from '@/lib/content'

async function renderToHtml(entry: CollectionEntry<'posts' | 'life'>) {
  return renderServerComponent(h(EntryView, { entry }))
}

function makeEntry(body: string): CollectionEntry<'posts' | 'life'> {
  return {
    collection: 'posts',
    slug: '2026-09-01-demo',
    data: { title: '演示文章', date: new Date('2026-09-01'), tags: [] },
    body,
  }
}

describe('EntryView 返回路径与元信息', () => {
  it('正文顶部有指向父级集合的文字返回（确定路由，非浏览器历史）', async () => {
    const html = await renderToHtml(makeEntry('正文'))

    expect(html).toContain('href="/posts"')
    expect(html).toContain('文章列表')
  })

  it('展示预估阅读时长与字数', async () => {
    const html = await renderToHtml(makeEntry('这是包含若干汉字的文章内容。'))

    expect(html).toContain('分钟阅读')
    expect(html).toContain('字')
  })
})

describe('EntryView 文首目录', () => {
  it('短文无目录', async () => {
    const html = await renderToHtml(makeEntry('## 结论\n\n正文'))

    expect(html).not.toContain('文章目录')
  })

  it('长文在正文前生成目录，链接与标题锚点一致', async () => {
    const html = await renderToHtml(makeEntry('## 一\n\n## 二\n\n## 三\n\n正文'))

    expect(html).toContain('aria-label="文章目录"')
    expect(html).toContain('href="#一"')
    expect(html).toContain('href="#二"')
    expect(html).toContain('href="#三"')
    expect(html).toContain('id="一"')
    // 目录出现在正文标题之前
    expect(html.indexOf('文章目录')).toBeLessThan(html.indexOf('id="一"'))
    // 正文上方折叠式目录在桌面端（xl）隐藏，避免与右侧常驻目录重复
    expect(html).toMatch(/<details[^>]*class="[^"]*xl:hidden[^"]*"/)
    // 正文区域包含 mx-auto，确保在非 xl 单列大屏下与上方元信息完全居中对齐
    expect(html).toMatch(/<article[^>]*class="[^"]*mx-auto[^"]*"/)
  })
})

describe('EntryView 异常渲染', () => {
  it('空正文不抛错，无目录但仍有返回', async () => {
    const html = await renderToHtml(makeEntry(''))

    expect(html).toContain('href="/posts"')
    expect(html).not.toContain('文章目录')
  })
})
