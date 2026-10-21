import { describe, expect, it, vi } from 'vitest'
import { getAllEntries } from '@/lib/content'
import { GET } from './route'

vi.mock('@/lib/content', () => ({
  getAllEntries: vi.fn(),
  isColumnEntry: (entry: { data: { column?: string | undefined } }) =>
    Boolean(entry.data.column),
}))

const mockedGetAllEntries = vi.mocked(getAllEntries)

describe('RSS route', () => {
  it('转义 URL，并安全处理描述中的 CDATA 结束符', async () => {
    mockedGetAllEntries.mockReturnValue([
      {
        collection: 'posts',
        slug: 'rss&test',
        data: {
          title: 'RSS <标题>',
          date: new Date('2026-09-01T00:00:00.000Z'),
          tags: [],
          description: '正文包含 ]]> 结束符',
        },
        body: 'fallback',
      },
    ] as never)

    const xml = await GET().text()

    expect(xml).toContain('https://orange-cnc.pages.dev/posts/rss&amp;test')
    expect(xml).toContain(']]]]><![CDATA[>')
    expect(xml).toContain('<title>RSS &lt;标题&gt;</title>')
  })

  it('专栏文章不进订阅源', async () => {
    mockedGetAllEntries.mockReturnValue([
      {
        collection: 'posts',
        slug: 'plain-post',
        data: {
          title: '普通文章',
          date: new Date('2026-09-01T00:00:00.000Z'),
          tags: [],
        },
        body: '正文',
      },
      {
        collection: 'posts',
        slug: 'column-post',
        data: {
          title: '专栏文章',
          date: new Date('2026-09-02T00:00:00.000Z'),
          tags: [],
          column: 'ai-ddd',
        },
        body: '正文',
      },
    ] as never)

    const xml = await GET().text()

    expect(xml).toContain('/posts/plain-post')
    expect(xml).not.toContain('/posts/column-post')
  })
})
