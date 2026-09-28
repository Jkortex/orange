import { describe, expect, it, vi } from 'vitest'
import { getAllEntries } from '@/lib/content'
import { GET } from './route'

vi.mock('@/lib/content', () => ({
  getAllEntries: vi.fn(),
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

    expect(xml).toContain('https://orange.example.com/posts/rss&amp;test')
    expect(xml).toContain(']]]]><![CDATA[>')
    expect(xml).toContain('<title>RSS &lt;标题&gt;</title>')
  })
})
