// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AlbumCard } from '@/components/player/album-card'
import { PlayerProvider } from '@/components/player/player-provider'
import { stubAudio, unstubAudio, type MockAudio } from '@/components/test-utils/mock-audio'

const album = {
  slug: '2026-09-01-orange',
  title: '橘色专辑',
  artist: '橘子',
  year: 2026,
  cover: '/media/music/covers/orange.jpg',
  tracks: [
    { title: '曲目一', file: '/media/music/a.mp3' },
    { title: '曲目二', file: '/media/music/b.mp3' },
  ],
}

let audio: MockAudio

beforeEach(() => {
  audio = stubAudio()
})

afterEach(() => {
  cleanup()
  unstubAudio()
})

function renderCard(props: Partial<typeof album> = {}) {
  return render(
    <PlayerProvider>
      <ul>
        <AlbumCard {...album} {...props} />
      </ul>
    </PlayerProvider>,
  )
}

describe('AlbumCard 正常渲染', () => {
  it('链接指向详情且仅承载标题，艺术家/年份为链接外的内容型文本', () => {
    const { container } = renderCard()

    const link = screen.getByRole('link', { name: '橘色专辑' })
    expect(link.getAttribute('href')).toBe('/music/2026-09-01-orange')

    // 艺术家与年份是内容型文本，永不隐藏（图标化规范）；链接只承载标题
    const card = container.querySelector('li')
    expect(card?.textContent).toContain('橘子')
    expect(card?.textContent).toContain('2026')

    const cover = screen.getByRole('img', { name: '橘色专辑 封面' })
    expect(cover.getAttribute('src')).toBe('/media/music/covers/orange.jpg')
  })

  it('无年份时不渲染年份分隔符', () => {
    const { container } = renderCard({ year: undefined })

    expect(container.querySelector('li')?.textContent).not.toContain('·')
  })

  it('播放按钮所有设备常显（iPad 匹配 hover:hover，hover 显示设计对其失效），携带 aria-label 与文字提示', () => {
    renderCard()

    const button = screen.getByRole('button', { name: '播放专辑《橘色专辑》' })
    expect(button.querySelector('.lucide-play')).not.toBeNull()

    // 常显：不依赖 hover 显示（iPadOS Safari 伪装桌面匹配 hover:hover，hover-only 控件在其上永远不可见）
    expect(button.className).not.toContain('opacity-0')
    expect(button.className).not.toContain('sm:opacity-0')

    const tip = button.querySelector('[data-tip]')
    expect(tip).not.toBeNull()
    expect(tip?.textContent).toBe('播放专辑《橘色专辑》')
  })
})

describe('AlbumCard 交互', () => {
  it('点击播放按钮将专辑曲目设为队列并从第一首起播', () => {
    renderCard()

    fireEvent.click(screen.getByRole('button', { name: '播放专辑《橘色专辑》' }))

    expect(audio.src).toBe('/media/music/a.mp3')
    expect(audio.play).toHaveBeenCalled()
  })

  it('播放中的专辑：封面按钮切换为暂停形态，点击暂停；再点恢复（不重设队列）', () => {
    renderCard()

    fireEvent.click(screen.getByRole('button', { name: '播放专辑《橘色专辑》' }))

    // 播放中：按钮切为暂停形态
    const pause = screen.getByRole('button', { name: '暂停专辑《橘色专辑》' })
    expect(pause.querySelector('.lucide-pause')).not.toBeNull()
    expect(pause.querySelector('[data-tip]')?.textContent).toBe('暂停专辑《橘色专辑》')

    // 点击暂停
    fireEvent.click(pause)
    expect(audio.pause).toHaveBeenCalled()

    // 暂停后按钮恢复播放形态，点击恢复而非重新起播（src 不重赋、play 第二次调用）
    fireEvent.click(screen.getByRole('button', { name: '播放专辑《橘色专辑》' }))
    expect(audio.play).toHaveBeenCalledTimes(2)
  })

  it('播放按钮独立于链接之外（交互元素不得嵌套）', () => {
    renderCard()

    const button = screen.getByRole('button', { name: '播放专辑《橘色专辑》' })

    expect(button.closest('a')).toBeNull()
  })
})

describe('AlbumCard 异常渲染', () => {
  it('无封面时显示兜底图标（lucide-music），不渲染 img', () => {
    const { container } = renderCard({ cover: undefined })

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.lucide-music')).not.toBeNull()
  })
})
