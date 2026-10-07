import { describe, expect, it, vi } from 'vitest'
import type { CollectionEntry } from '@/lib/content'

vi.mock('@/lib/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content')>()
  return { ...actual, getDrafts: vi.fn() }
})

import { getDrafts } from '@/lib/content'
import { generateStaticParams } from './page'

const mockedGetDrafts = vi.mocked(getDrafts)

function draft(slug: string): CollectionEntry<'posts'> {
  return {
    collection: 'posts',
    slug,
    data: { title: slug, date: new Date('2026-09-01'), tags: [] },
    body: '正文',
  }
}

describe('草稿详情路由 generateStaticParams', () => {
  it('有草稿时返回真实 slug 列表', () => {
    mockedGetDrafts.mockReturnValue([draft('2026-09-01-a'), draft('2026-09-13-b')])

    expect(generateStaticParams()).toEqual([{ slug: '2026-09-01-a' }, { slug: '2026-09-13-b' }])
  })

  it('无草稿（生产构建）时返回哨兵 __empty__，避免 output:export 下空参数报错', () => {
    mockedGetDrafts.mockReturnValue([])

    expect(generateStaticParams()).toEqual([{ slug: '__empty__' }])
  })
})
