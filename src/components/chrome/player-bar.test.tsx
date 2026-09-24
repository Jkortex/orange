// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PlayerBar } from '@/components/chrome/player-bar'
import { PlayerProvider, usePlayer, type PlayerTrack } from '@/components/player/player-provider'
import { stubAudio, unstubAudio, type MockAudio } from '@/components/test-utils/mock-audio'

const tracks: PlayerTrack[] = [
  { title: '曲目一', file: '/media/music/a.mp3', cover: '/media/music/covers/a.jpg', artist: '橘子' },
  { title: '曲目二', file: '/media/music/b.mp3' },
]

let audio: MockAudio

// 测试触发器：通过 usePlayer 设置队列，驱动 PlayerBar 状态
function PlayButton({ list }: { list: PlayerTrack[] }) {
  const { playAlbum } = usePlayer()
  return <button onClick={() => playAlbum(list)}>开始播放</button>
}

function renderBar(list: PlayerTrack[] = tracks) {
  return render(
    <PlayerProvider>
      <PlayerBar />
      <PlayButton list={list} />
    </PlayerProvider>,
  )
}

// 滑杆可及名挂在分组上（Radix Slider 的 aria-label 落根节点、手柄继承不到，
// 故用 role=group 命名，AT 播报分组名 + 手柄值；实现见 player-bar.tsx）
function progressSlider() {
  return within(screen.getByRole('group', { name: '播放进度' })).getByRole('slider')
}

function volumeSlider() {
  return within(screen.getByRole('group', { name: '音量' })).getByRole('slider')
}

beforeEach(() => {
  audio = stubAudio()
  // jsdom 无 ResizeObserver（Radix Slider 量手柄尺寸用），空实现打桩
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  unstubAudio()
  localStorage.clear()
})

describe('PlayerBar 正常渲染', () => {
  it('无队列时不渲染播放条', () => {
    renderBar([])

    expect(screen.queryByRole('button', { name: '播放' })).toBeNull()
    expect(screen.queryByText('曲目一')).toBeNull()
  })

  it('有队列时显示当前曲目名与播放/上一首/下一首控件', () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    expect(screen.getByText('曲目一')).toBeTruthy()
    expect(screen.getByRole('button', { name: '暂停' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '上一首' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '下一首' })).toBeTruthy()
  })

  it('曲目带封面时显示封面图，无封面时显示兜底图标', () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    const bar = document.querySelector('[data-bar]')
    expect(bar?.querySelector('img')?.getAttribute('src')).toBe('/media/music/covers/a.jpg')

    fireEvent.click(screen.getByRole('button', { name: '下一首' }))
    expect(bar?.querySelector('img')).toBeNull()
    expect(bar?.querySelector('.lucide-music')).not.toBeNull()
  })
})

describe('PlayerBar 交互', () => {
  it('播放中显示「暂停」，点击暂停后再播放', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    expect(audio.pause).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '播放' }))
    expect(audio.play).toHaveBeenCalled()
  })

  it('播放条为 fixed 悬浮层，不占文档流、footer 不让位（滚动到底时 footer 下缘被覆盖）', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    const bar = document.querySelector('[data-bar]')
    expect(bar?.className).toContain('fixed')
    expect(bar?.className).toContain('bottom-0')
    expect(bar?.className).not.toContain('sticky')
  })

  it('上一首/下一首按钮具备足够触摸目标（size-9 = 36px，移动端可点中）', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    for (const name of ['上一首', '下一首']) {
      const button = screen.getByRole('button', { name })
      expect(button.className).toContain('size-9')
      expect(button.getAttribute('data-size')).toBe('md')
    }
  })

  it('上一首/下一首切换当前曲目', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    fireEvent.click(screen.getByRole('button', { name: '下一首' }))
    expect(screen.getByText('曲目二')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '上一首' }))
    expect(screen.getByText('曲目一')).toBeTruthy()
  })

  it('关闭按钮清除队列，播放条消失（恢复零留白）', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))
    expect(document.querySelector('[data-bar]')).not.toBeNull()

    const close = screen.getByRole('button', { name: '关闭播放条' })
    expect(close.parentElement?.querySelector('[data-tip]')?.textContent).toBe('关闭播放条')

    fireEvent.click(close)
    expect(document.querySelector('[data-bar]')).toBeNull()
  })
})

describe('PlayerBar 进度与时间（规格 §5）', () => {
  it('显示播放进度滑杆与当前时间/总时长，未知时长如实 --:--', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    expect(progressSlider()).toBeTruthy()
    expect(screen.getByText('0:00')).toBeTruthy()
    expect(screen.getByText('--:--')).toBeTruthy()
  })

  it('元数据就绪后显示总时长，播放推进更新当前时间', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))
    act(() => {
      audio.duration = 180
      audio.emit('loadedmetadata')
    })
    expect(screen.getByText('3:00')).toBeTruthy()

    act(() => {
      audio.currentTime = 42
      audio.emit('timeupdate')
    })
    expect(screen.getByText('0:42')).toBeTruthy()
  })

  it('键盘调节进度滑杆跳转播放位置（不改变播放态）', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))
    act(() => {
      audio.duration = 180
      audio.emit('loadedmetadata')
    })

    const slider = progressSlider()
    slider.focus()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(audio.currentTime).toBe(1)
  })
})

describe('PlayerBar 音量（规格 §6）', () => {
  it('静音按钮切换静音态，图标随状态变化', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    fireEvent.click(screen.getByRole('button', { name: '静音' }))
    expect(audio.muted).toBe(true)
    expect(screen.getByRole('button', { name: '取消静音' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '取消静音' }))
    expect(audio.muted).toBe(false)
  })

  it('音量滑杆键盘可调', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    const slider = volumeSlider()
    slider.focus()
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })

    expect(audio.volume).toBeCloseTo(0.95)
  })

  it('音量控件窄屏收起，核心控制常显', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '开始播放' }))

    const volumeGroup = volumeSlider().closest('[data-volume]')
    expect(volumeGroup?.className).toContain('hidden')
    // 核心控制不受影响
    expect(screen.getByRole('button', { name: '暂停' })).toBeTruthy()
    expect(progressSlider()).toBeTruthy()
  })
})
