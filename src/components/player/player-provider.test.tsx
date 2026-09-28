// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { PlayerProvider, usePlayer, usePlayerIndex, type PlayerTrack } from '@/components/player/player-provider'
import { stubAudio, type MockAudio } from '@/components/test-utils/mock-audio'

const tracks: PlayerTrack[] = [
  { title: '曲目一', file: '/media/music/a.mp3' },
  { title: '曲目二', file: '/media/music/b.mp3' },
  { title: '曲目三', file: '/media/music/c.mp3' },
]

let audio: MockAudio

function setup() {
  return renderHook(() => usePlayer(), { wrapper: PlayerProvider })
}

beforeEach(() => {
  audio = stubAudio()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('PlayerProvider 正常状态', () => {
  it('初始无队列：queue 空、index null、playing false', () => {
    const { result } = setup()

    expect(result.current.queue).toEqual([])
    expect(result.current.index).toBeNull()
    expect(result.current.playing).toBe(false)
  })

  it('playAlbum 从第一首起播：设置队列、更新 src 并调用 play', () => {
    const { result } = setup()

    act(() => result.current.playAlbum(tracks))

    expect(result.current.queue).toEqual(tracks)
    expect(result.current.index).toBe(0)
    expect(result.current.playing).toBe(true)
    expect(audio.src).toBe('/media/music/a.mp3')
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('playAlbum 可从指定曲目起播', () => {
    const { result } = setup()

    act(() => result.current.playAlbum(tracks, 1))

    expect(result.current.index).toBe(1)
    expect(audio.src).toBe('/media/music/b.mp3')
  })

  it('playAlbum 新队列从头开始（同文件重播也复位进度）', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks))
    act(() => {
      audio.currentTime = 150
      audio.emit('timeupdate')
    })
    expect(result.current.currentTime).toBe(150)

    // 同一专辑点「播放全部」：src 不变但必须从头播，不能从 150 秒处继续
    act(() => result.current.playAlbum(tracks))

    expect(audio.currentTime).toBe(0)
    expect(result.current.currentTime).toBe(0)
    expect(result.current.playing).toBe(true)
  })

  it('toggle 在暂停与播放之间切换，调用 pause/play', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks))

    act(() => result.current.toggle())
    expect(result.current.playing).toBe(false)
    expect(audio.pause).toHaveBeenCalledTimes(1)

    act(() => result.current.toggle())
    expect(result.current.playing).toBe(true)
    expect(audio.play).toHaveBeenCalledTimes(2)
  })

  it('toggle 暂停/恢复不重新赋值 src（保留播放进度）', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks))
    expect(audio.srcSetCount).toBe(1)

    act(() => result.current.toggle())
    act(() => result.current.toggle())

    expect(result.current.playing).toBe(true)
    expect(audio.srcSetCount).toBe(1)
  })

  it('next/prev 切换曲目并更新 src', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks, 1))

    act(() => result.current.next())
    expect(result.current.index).toBe(2)
    expect(audio.src).toBe('/media/music/c.mp3')

    act(() => result.current.prev())
    expect(result.current.index).toBe(1)
    expect(audio.src).toBe('/media/music/b.mp3')
  })

  it('clear 清空队列并停止播放（audio pause，index 复位），进度与时长复位', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks))
    act(() => {
      audio.duration = 180
      audio.emit('loadedmetadata')
      audio.currentTime = 42
      audio.emit('timeupdate')
    })

    act(() => result.current.clear())

    expect(result.current.queue).toHaveLength(0)
    expect(result.current.index).toBeNull()
    expect(result.current.playing).toBe(false)
    expect(audio.pause).toHaveBeenCalled()
    expect(result.current.currentTime).toBe(0)
    expect(Number.isNaN(result.current.duration)).toBe(true)
  })

  it('第一首时 prev 不后退，最后一首时 next 不前进', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks, 0))

    act(() => result.current.prev())
    expect(result.current.index).toBe(0)

    act(() => result.current.playAlbum(tracks, 2))
    act(() => result.current.next())
    expect(result.current.index).toBe(2)
  })

  it('曲目自然结束自动播放下一首', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks, 0))
    const playTimes = audio.play.mock.calls.length

    act(() => audio.emit('ended'))

    expect(result.current.index).toBe(1)
    expect(audio.src).toBe('/media/music/b.mp3')
    expect(audio.play.mock.calls.length).toBe(playTimes + 1)
  })
})

describe('PlayerProvider 异常边界', () => {
  it('队列播完（最后一首结束）时停止播放', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks, 2))

    act(() => audio.emit('ended'))

    expect(result.current.index).toBe(2)
    expect(result.current.playing).toBe(false)
    expect(audio.pause).toHaveBeenCalled()
  })

  it('playAlbum 传空队列时忽略，状态不变', () => {
    const { result } = setup()

    act(() => result.current.playAlbum([]))

    expect(result.current.queue).toEqual([])
    expect(result.current.index).toBeNull()
    expect(result.current.playing).toBe(false)
  })

  it('无队列时 toggle/next/prev 不抛错', () => {
    const { result } = setup()

    expect(() => {
      act(() => result.current.toggle())
      act(() => result.current.next())
      act(() => result.current.prev())
    }).not.toThrow()

    expect(result.current.index).toBeNull()
  })

  it('自动播放被浏览器拦截（play 拒绝）时降级为暂停，不抛错', async () => {
    audio.play.mockRejectedValueOnce(new Error('NotAllowedError'))
    const { result } = setup()

    // play 拒绝发生在微任务里，需异步 act 等待降级状态生效
    await act(async () => {
      result.current.playAlbum(tracks)
    })

    expect(result.current.index).toBe(0)
    expect(result.current.playing).toBe(false)
  })

  it('usePlayer 在 Provider 之外使用时抛错', () => {
    // 直接渲染 hook 不包 wrapper
    expect(() => renderHook(() => usePlayer())).toThrowError()
  })

  it('进度更新不重渲染只订阅播放索引的消费者', () => {
    let indexRenders = 0

    function IndexObserver() {
      usePlayerIndex()
      indexRenders += 1
      return null
    }

    function Controls() {
      const { playAlbum } = usePlayer()
      return (
        <button type="button" onClick={() => playAlbum(tracks)}>
          开始播放
        </button>
      )
    }

    render(
      <PlayerProvider>
        <IndexObserver />
        <Controls />
      </PlayerProvider>,
    )

    const beforeQueue = indexRenders
    act(() => {
      screen.getByRole('button', { name: '开始播放' }).click()
    })
    const afterQueue = indexRenders
    expect(afterQueue).toBeGreaterThan(beforeQueue)

    act(() => {
      audio.emit('timeupdate')
    })

    expect(indexRenders).toBe(afterQueue)
  })
})

describe('PlayerProvider 音量（规格 §6）', () => {
  it('默认音量 1、非静音', () => {
    const { result } = setup()

    expect(result.current.volume).toBe(1)
    expect(result.current.muted).toBe(false)
  })

  it('setVolume 设置音量并同步 audio', () => {
    const { result } = setup()

    act(() => result.current.setVolume(0.4))

    expect(result.current.volume).toBe(0.4)
    expect(result.current.muted).toBe(false)
    expect(audio.volume).toBe(0.4)
    expect(audio.muted).toBe(false)
  })

  it('setVolume 越界钳制到 0..1', () => {
    const { result } = setup()

    act(() => result.current.setVolume(2))
    expect(result.current.volume).toBe(1)

    act(() => result.current.setVolume(-1))
    expect(result.current.volume).toBe(0)
  })

  it('拖到 0 即静音表现，从 0 拉起即取消静音', () => {
    const { result } = setup()

    act(() => result.current.setVolume(0))
    expect(result.current.muted).toBe(true)
    expect(audio.muted).toBe(true)

    act(() => result.current.setVolume(0.5))
    expect(result.current.muted).toBe(false)
    expect(audio.muted).toBe(false)
  })

  it('toggleMute 静音后取消恢复原音量', () => {
    const { result } = setup()
    act(() => result.current.setVolume(0.6))

    act(() => result.current.toggleMute())
    expect(result.current.muted).toBe(true)
    expect(result.current.volume).toBe(0.6)
    expect(audio.muted).toBe(true)

    act(() => result.current.toggleMute())
    expect(result.current.muted).toBe(false)
    expect(result.current.volume).toBe(0.6)
    expect(audio.muted).toBe(false)
  })

  it('音量为 0 时取消静音，恢复上次非零音量而非静默', () => {
    const { result } = setup()
    act(() => result.current.setVolume(0.6))
    act(() => result.current.setVolume(0))

    act(() => result.current.toggleMute())

    expect(result.current.muted).toBe(false)
    expect(result.current.volume).toBe(0.6)
    expect(audio.volume).toBe(0.6)
  })

  it('音量偏好持久化，重新挂载后恢复', () => {
    const first = setup()
    act(() => first.result.current.setVolume(0.4))
    act(() => first.result.current.toggleMute())
    first.unmount()

    const second = setup()

    expect(second.result.current.volume).toBe(0.4)
    expect(second.result.current.muted).toBe(true)
    expect(audio.volume).toBe(0.4)
    expect(audio.muted).toBe(true)
  })

  it('localStorage 不可用时设置音量不抛错', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { result } = setup()

    expect(() => act(() => result.current.setVolume(0.3))).not.toThrow()
    expect(result.current.volume).toBe(0.3)
  })
})

describe('PlayerProvider 进度与失败（规格 §5/§9）', () => {
  it('初始进度 0、时长未知', () => {
    const { result } = setup()

    expect(result.current.currentTime).toBe(0)
    expect(Number.isNaN(result.current.duration)).toBe(true)
  })

  it('timeupdate 同步当前时间，loadedmetadata 同步总时长', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks))

    act(() => {
      audio.currentTime = 42
      audio.emit('timeupdate')
    })
    expect(result.current.currentTime).toBe(42)

    act(() => {
      audio.duration = 180
      audio.emit('loadedmetadata')
    })
    expect(result.current.duration).toBe(180)
  })

  it('seekTo 跳转指定位置，不改变播放态', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks))
    act(() => {
      audio.duration = 180
      audio.emit('loadedmetadata')
    })

    act(() => result.current.seekTo(60))

    expect(audio.currentTime).toBe(60)
    expect(result.current.currentTime).toBe(60)
    expect(result.current.playing).toBe(true)
  })

  it('seekTo 越界钳制到首尾', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks))
    act(() => {
      audio.duration = 180
      audio.emit('loadedmetadata')
    })

    act(() => result.current.seekTo(999))
    expect(audio.currentTime).toBe(180)

    act(() => result.current.seekTo(-5))
    expect(audio.currentTime).toBe(0)
  })

  it('音频失败时停止播放但保留队列与位置（不静默跳过）', () => {
    const { result } = setup()
    act(() => result.current.playAlbum(tracks, 1))

    act(() => {
      audio.emit('error')
    })

    expect(result.current.playing).toBe(false)
    expect(result.current.queue).toHaveLength(3)
    expect(result.current.index).toBe(1)
  })
})
