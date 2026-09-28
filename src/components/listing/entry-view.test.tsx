import { readFileSync } from 'node:fs'
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

/*
 * 相关推荐已下线（判断：信息量低、干扰阅读，还要额外维护一份推荐预聚合）。
 * 这里留一条守卫，避免以后又被顺手加回来。
 */
describe('EntryView 不再渲染相关推荐', () => {
  it('即使有共同标签，详情页也不再出现相关推荐区块', async () => {
    const entry: CollectionEntry<'posts'> = {
      collection: 'posts',
      slug: '2026-09-01-demo',
      // 真实内容里存在的标签：确保旧的推荐逻辑会算出结果，守卫才有意义
      data: { title: '演示文章', date: new Date('2026-09-01'), tags: ['CSS'] },
      body: '## 一\n\n## 二\n\n## 三\n\n正文',
    }

    const html = await renderToHtml(entry)

    expect(html).not.toContain('相关推荐')
  })

  it('相邻翻页不受影响（不随相关推荐一起删掉）', () => {
    const source = readFileSync('src/components/listing/entry-view.tsx', 'utf8')

    expect(source).toContain('<AdjacentNav')
  })
})

describe('EntryView 生活随笔详情渲染', () => {
  it('生活随笔渲染照片画廊、地点天气与返回生活列表，且隐藏文章阅读时长', async () => {
    const lifeEntry: CollectionEntry<'life'> = {
      collection: 'life',
      slug: '2026-09-12-westlake-sunset',
      data: {
        title: '西湖落日与黄昏',
        date: new Date('2026-09-12'),
        tags: ['摄影'],
        location: '杭州 · 西湖长桥',
        weather: '🌇 晴',
        photos: ['/media/life/sunset.svg', '/media/life/coffee.svg'],
      },
      body: '傍晚西湖长桥的风很舒服。',
    }

    const html = await renderToHtml(lifeEntry)

    expect(html).toContain('href="/life"')
    expect(html).toContain('生活')
    expect(html).toContain('杭州 · 西湖长桥')
    expect(html).toContain('🌇 晴')
    expect(html).toContain('/media/life/sunset.svg')
    expect(html).toContain('/media/life/coffee.svg')
    expect(html).not.toContain('分钟阅读')
  })
})
