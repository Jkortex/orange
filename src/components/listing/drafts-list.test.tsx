import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderServerComponent } from '@/components/test-utils/render-server'
import { DraftsList } from '@/components/listing/drafts-list'

describe('DraftsList 正常渲染', () => {
  it('渲染指向 /drafts/<slug> 的链接、标题与格式化日期', async () => {
    const html = await renderServerComponent(
      h(DraftsList, {
        drafts: [
          { slug: '2026-09-13-a', title: '草稿一', date: '2026-09-13T00:00:00.000Z' },
          {
            slug: '2026-09-01-b',
            title: '草稿二',
            date: '2026-09-01T00:00:00.000Z',
            description: '草稿二描述',
          },
        ],
      }),
    )

    expect(html).toContain('href="/drafts/2026-09-13-a"')
    expect(html).toContain('href="/drafts/2026-09-01-b"')
    expect(html).toContain('草稿一')
    expect(html).toContain('草稿二描述')
    expect(html).toContain('2026-09-13')
  })
})

describe('DraftsList 异常渲染', () => {
  it('空列表渲染空态文案', async () => {
    const html = await renderServerComponent(h(DraftsList, { drafts: [] }))

    expect(html).toContain('还没有草稿')
  })
})
