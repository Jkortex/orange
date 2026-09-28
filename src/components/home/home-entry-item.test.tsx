// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HomeEntryItem } from './home-entry-item'
import type { CollectionEntry, CollectionType } from '@/lib/content'

afterEach(() => {
  cleanup()
})

describe('HomeEntryItem 渲染', () => {
  it('正常渲染文章条目（含日期与标签）', () => {
    const postEntry: CollectionEntry<'posts'> = {
      collection: 'posts',
      slug: 'hello-world',
      data: {
        title: '测试文章标题',
        date: new Date('2025-01-01T00:00:00.000Z'),
        tags: ['React', 'Next.js'],
      },
      body: 'Hello',
    }

    render(<HomeEntryItem entry={postEntry as CollectionEntry<CollectionType>} />)
    const link = screen.getByRole('link', { name: '测试文章标题' })
    expect(link.getAttribute('href')).toBe('/posts/hello-world')
    expect(screen.getByText(/React \/ Next\.js/)).toBeTruthy()
  })

  it('正常渲染音乐条目（含艺术家、年份与封面）', () => {
    const musicEntry: CollectionEntry<'music'> = {
      collection: 'music',
      slug: 'my-album',
      data: {
        title: '测试专辑',
        date: new Date('2025-01-01T00:00:00.000Z'),
        tags: [],
        artist: '测试歌手',
        year: 2024,
        cover: '/covers/album.jpg',
        tracks: [{ title: 'Track 1', file: 't1.mp3' }],
      },
      body: '',
    }

    const { container } = render(<HomeEntryItem entry={musicEntry as CollectionEntry<CollectionType>} />)
    expect(screen.getByText('测试专辑')).toBeTruthy()
    expect(screen.getByText(/测试歌手 · 2024/)).toBeTruthy()
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('/covers/album.jpg')
  })
})

/* 列表行标题统一最多两行；首页是时间线，日期保留（它独占一行，不与标题抢横向空间） */
describe('HomeEntryItem 行布局', () => {
  const postEntry: CollectionEntry<'posts'> = {
    collection: 'posts',
    slug: 'hello-world',
    data: { title: '测试文章标题', date: new Date('2025-01-01T00:00:00.000Z'), tags: ['React'] },
    body: '',
  }

  it('文章标题最多两行', () => {
    render(<HomeEntryItem entry={postEntry as CollectionEntry<CollectionType>} />)

    const link = screen.getByRole('link', { name: '测试文章标题' })
    expect(link.className).toContain('line-clamp-2')
    expect(link.className).not.toContain('truncate')
  })

  it('时间线保留日期（首页的价值就是「最近更新了什么」）', () => {
    render(<HomeEntryItem entry={postEntry as CollectionEntry<CollectionType>} />)

    expect(screen.getByText('2025-01-01')).toBeTruthy()
  })
})
