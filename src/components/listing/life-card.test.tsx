// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LifeCard } from '@/components/listing/life-card'
import type { CollectionEntry } from '@/lib/content'

afterEach(() => {
  cleanup()
})

describe('LifeCard 碎碎念生活卡片组件', () => {
  const mockEntry: CollectionEntry<'life'> = {
    collection: 'life',
    slug: '2026-09-15-rainy-walk',
    data: {
      title: '雨后漫步',
      date: new Date('2026-09-15T15:20:00+08:00'),
      tags: ['日常', '散步'],
      location: '杭州',
      weather: '🌧️ 小雨',
      photos: ['/media/life/photo1.svg', '/media/life/photo2.svg'],
    },
    body: '雨停后在西湖边走走，桂花初开。',
  }

  it('正常渲染标题、正文、地点、天气与标签', () => {
    render(<LifeCard entry={mockEntry} />)

    expect(screen.getByText('雨后漫步')).toBeTruthy()
    expect(screen.getByText('雨停后在西湖边走走，桂花初开。')).toBeTruthy()
    expect(screen.getByText('📍 杭州')).toBeTruthy()
    expect(screen.getByText('🌧️ 小雨')).toBeTruthy()
    expect(screen.getByText('#日常')).toBeTruthy()
    expect(screen.getByText('#散步')).toBeTruthy()
  })

  it('渲染图片并在点击时打开 Radix Dialog 灯箱', () => {
    render(<LifeCard entry={mockEntry} />)

    const images = screen.getAllByRole('img')
    expect(images.length).toBe(2)

    // 点击第一张缩略图
    fireEvent.click(images[0])

    // 灯箱 dialog 应该弹出
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
  })

  it('支持无图的纯文本微动态', () => {
    const textEntry: CollectionEntry<'life'> = {
      ...mockEntry,
      data: {
        ...mockEntry.data,
        photos: [],
      },
    }

    render(<LifeCard entry={textEntry} />)

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('雨后漫步')).toBeTruthy()
  })
})
