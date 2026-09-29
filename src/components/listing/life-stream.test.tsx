// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LifeStream } from '@/components/listing/life-stream'
import type { CollectionEntry } from '@/lib/content'

afterEach(() => {
  cleanup()
})

describe('LifeStream 纯净生活流', () => {
  const mockEntries: CollectionEntry<'life'>[] = [
    {
      collection: 'life',
      slug: '2026-09-15-rainy-tea',
      data: {
        title: '雨后漫步与桂花乌龙',
        date: new Date('2026-09-15T15:20:00+08:00'),
        location: '杭州 · 西湖区',
        weather: '🌧️ 小雨',
        tags: ['日常', '漫步'],
        photos: [],
      },
      body: '窗外的雨下了一整天，喝了桂花乌龙。',
    },
    {
      collection: 'life',
      slug: '2026-09-12-westlake-sunset',
      data: {
        title: '西湖落日与黄昏',
        date: new Date('2026-09-12T18:40:00+08:00'),
        location: '杭州 · 西湖长桥',
        weather: '🌇 晴',
        tags: ['摄影', '西湖'],
        photos: [],
      },
      body: '橙红色的晚霞染透了半边天空。',
    },
  ]

  it('空数据时渲染 EmptyState', () => {
    render(<LifeStream entries={[]} />)
    expect(screen.getByText('暂无生活记录')).toBeTruthy()
  })

  it('正常渲染总数与全部卡片', () => {
    render(<LifeStream entries={mockEntries} />)

    expect(screen.getByText('共 2 条生活记录 · 按时间倒序')).toBeTruthy()
    expect(screen.getByText('雨后漫步与桂花乌龙')).toBeTruthy()
    expect(screen.getByText('西湖落日与黄昏')).toBeTruthy()
  })
})
