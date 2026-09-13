// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BackToTop } from './back-to-top'
import { PlayerProvider, usePlayer, type PlayerTrack } from './player-provider'
import { stubAudio } from './test-utils/mock-audio'

// jsdom 未实现 matchMedia，按需打桩（Audio 打桩见 test-utils/mock-audio）

const tracks: PlayerTrack[] = [{ title: '曲目一', file: '/media/music/a.mp3' }]

// 测试触发器：入队以模拟播放条出现
function PlayButton() {
  const { playAlbum } = usePlayer()
  return <button onClick={() => playAlbum(tracks)}>开始播放</button>
}

function renderTop() {
  return render(
    <PlayerProvider>
      <BackToTop />
      <PlayButton />
    </PlayerProvider>,
  )
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true })
  fireEvent.scroll(window)
}

let reduceMotion = false

beforeEach(() => {
  stubAudio()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduceMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  vi.stubGlobal('scrollTo', vi.fn())
  reduceMotion = false
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BackToTop 正常渲染', () => {
  it('未滚动时不渲染（不常驻占位）', () => {
    renderTop()

    expect(screen.queryByRole('button', { name: '回到顶部' })).toBeNull()
  })

  it('滚动超一屏后出现，点击回到顶部', () => {
    renderTop()
    setScrollY(900)

    const button = screen.getByRole('button', { name: '回到顶部' })
    fireEvent.click(button)

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('减少动态偏好开启时直接跳转（无平滑滚动）', () => {
    reduceMotion = true
    renderTop()
    setScrollY(900)

    fireEvent.click(screen.getByRole('button', { name: '回到顶部' }))

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('图标按钮语义完备：aria-label 与 hover 提示一致，触摸目标达标', () => {
    renderTop()
    setScrollY(900)

    const button = screen.getByRole('button', { name: '回到顶部' })
    expect(button.className).toContain('size-9')
    const tip = button.parentElement?.querySelector('[data-tip]')
    expect(tip?.textContent).toBe('回到顶部')
  })
})

describe('BackToTop 异常渲染', () => {
  it('有播放队列时上移避让播放条，无队列时贴近底部', () => {
    renderTop()
    setScrollY(900)

    const idleBottom = screen.getByRole('button', { name: '回到顶部' }).parentElement?.className ?? ''
    expect(idleBottom).toContain('bottom-6')

    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))
    const busyBottom = screen.getByRole('button', { name: '回到顶部' }).parentElement?.className ?? ''
    expect(busyBottom).toContain('bottom-20')
    expect(busyBottom).not.toContain('bottom-6')
  })

  it('滚回顶部后按钮消失', () => {
    renderTop()
    setScrollY(900)
    expect(screen.getByRole('button', { name: '回到顶部' })).toBeTruthy()

    setScrollY(0)
    expect(screen.queryByRole('button', { name: '回到顶部' })).toBeNull()
  })
})
