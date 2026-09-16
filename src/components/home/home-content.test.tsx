// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HomeContent } from './home-content'
import type { CollectionEntry, CollectionType } from '@/lib/content'

afterEach(() => {
  cleanup()
})

describe('HomeContent 渲染', () => {
  it('当没有内容时渲染 EmptyState', () => {
    render(<HomeContent entries={[]} />)
    expect(screen.getByText('还没有内容。')).toBeTruthy()
    expect(screen.getByText('0 篇')).toBeTruthy()
  })

  it('渲染条目列表和数量统计', () => {
    const mockEntries: CollectionEntry<CollectionType>[] = [
      {
        collection: 'posts',
        slug: 'post-1',
        data: {
          title: 'Post 1',
          date: new Date('2025-01-01T00:00:00.000Z'),
          tags: ['tech'],
        },
        body: '',
      },
      {
        collection: 'music',
        slug: 'album-1',
        data: {
          title: 'Album 1',
          date: new Date('2025-01-02T00:00:00.000Z'),
          tags: [],
          artist: 'Artist 1',
          tracks: [{ title: 'T1', file: 't1.mp3' }],
        },
        body: '',
      },
    ]

    render(<HomeContent entries={mockEntries} />)
    expect(screen.getByText('最近更新')).toBeTruthy()
    expect(screen.getByText('2 篇')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Post 1' })).toBeTruthy()
    expect(screen.getByText('Album 1')).toBeTruthy()
  })
})
