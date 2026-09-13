import { vi } from 'vitest'

/*
 * 共享测试替身：jsdom 未实现媒体播放，所有播放器相关测试统一用它替换 Audio。
 * - play/pause 为 vi.fn，可断言调用与伪造拒绝（自动播放拦截降级）
 * - src 赋值计数：浏览器对同值赋值也会重载媒体（进度归零），供"不重复赋值"断言
 * - emit 手动触发 ended 等事件，验证自动下一首
 */

export class MockAudio {
  private _src = ''
  /** src 赋值次数 */
  srcSetCount = 0
  get src() {
    return this._src
  }
  set src(value: string) {
    this._src = value
    this.srcSetCount += 1
  }
  paused = true
  /** 播放位置（秒）与总时长（未知时 NaN，与 HTMLAudioElement 一致） */
  currentTime = 0
  duration = NaN
  volume = 1
  muted = false
  private handlers = new Map<string, Set<() => void>>()
  play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  addEventListener(type: string, handler: () => void) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
  }
  removeEventListener(type: string, handler: () => void) {
    this.handlers.get(type)?.delete(handler)
  }
  emit(type: string) {
    this.handlers.get(type)?.forEach((handler) => handler())
  }
}

/** new Audio() 返回测试持有的同一实例（构造器显式返回对象时 new 采用该对象） */
export function stubAudio(): MockAudio {
  const audio = new MockAudio()
  vi.stubGlobal(
    'Audio',
    (function () {
      return audio
    }) as unknown as typeof Audio,
  )
  return audio
}

/** 与 stubAudio 配对：afterEach 中恢复全局 Audio */
export function unstubAudio(): void {
  vi.unstubAllGlobals()
}
