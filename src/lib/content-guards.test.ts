import { describe, expect, it } from 'vitest'
import { isMusic } from '@/lib/content-guards'
import type { CollectionEntry, CollectionType } from '@/lib/content'

describe('isMusic 类型守卫', () => {
  it('识别音乐条目为 true', () => {
    const musicEntry = {
      collection: 'music' as const,
      slug: 'sample-album',
      data: {
        title: 'Sample',
        date: new Date(),
        tags: [],
        artist: 'Artist',
        tracks: [{ title: 'Track 1', file: 'track1.mp3' }],
      },
      body: '',
    } as CollectionEntry<CollectionType>

    expect(isMusic(musicEntry)).toBe(true)
  })

  it('非音乐条目返回 false', () => {
    const postEntry = {
      collection: 'posts' as const,
      slug: 'hello-world',
      data: {
        title: 'Hello',
        date: new Date(),
        tags: [],
      },
      body: '',
    } as CollectionEntry<CollectionType>

    expect(isMusic(postEntry)).toBe(false)
  })
})
