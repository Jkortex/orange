'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/*
 * 全局播放状态（AGENTS.md 界面布局规范第 3 条）：
 * - layout 层唯一持有队列与单例音频，页面切换播放不中断
 * - 组件不得自行创建 Audio 实例，一律经 usePlayer 操作
 * - 无队列时不渲染播放条（由消费方判断 queue.length）
 */

export type PlayerTrack = {
  title: string
  file: string
  /** 封面缩略图（专辑封面，供播放条展示） */
  cover?: string
  artist?: string
}

type PlayerContextValue = {
  queue: PlayerTrack[]
  index: number | null
  playing: boolean
  /** 当前播放位置（秒），由 timeupdate 同步 */
  currentTime: number
  /** 总时长（秒），元数据未就绪时 NaN（诚实未知态，规格 §5.3） */
  duration: number
  /** 音量 0..1（规格 §6） */
  volume: number
  muted: boolean
  /** 设置队列并从 start（默认 0）起播；tracks 为空时忽略 */
  playAlbum: (tracks: PlayerTrack[], start?: number) => void
  toggle: () => void
  next: () => void
  prev: () => void
  /** 跳转到指定秒数（越界钳制），不改变播放态 */
  seekTo: (seconds: number) => void
  /** 设置音量（越界钳制）；0 即静音表现，非 0 即取消静音 */
  setVolume: (value: number) => void
  /** 静音切换；取消静音恢复静音前音量（为 0 时恢复上次非零音量） */
  toggleMute: () => void
  /** 关闭播放条：清空队列并停止播放 */
  clear: () => void
}

type PlayerStateValue = Pick<PlayerContextValue, 'queue' | 'index' | 'playing'>
type PlayerTimeValue = Pick<PlayerContextValue, 'currentTime' | 'duration' | 'volume' | 'muted'>
type PlayerActionsValue = Pick<
  PlayerContextValue,
  'playAlbum' | 'toggle' | 'next' | 'prev' | 'seekTo' | 'setVolume' | 'toggleMute' | 'clear'
>
type PlayerPlaybackValue = PlayerStateValue & PlayerActionsValue

const VOLUME_KEY = 'player-volume'

// 状态、进度与动作拆成三个 Context：timeupdate 只更新进度 Context，
// 不再让搜索、返回顶部等只关心队列/播放态的组件跟着重渲染。
const PlayerStateContext = createContext<PlayerStateValue | null>(null)
const PlayerTimeContext = createContext<PlayerTimeValue | null>(null)
const PlayerActionsContext = createContext<PlayerActionsValue | null>(null)

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PlayerTrack[]>([])
  const [index, setIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(NaN)
  const [volume, setVolumeState] = useState(1)
  const [muted, setMuted] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentFileRef = useRef<string | null>(null)
  const lastVolumeRef = useRef(1)
  // 回调闭包过期问题统一用 ref 镜像（queue/index 供 ended 与切歌，volume/muted 供 toggleMute）
  const queueRef = useRef(queue)
  const indexRef = useRef(index)
  const volumeRef = useRef(volume)
  const mutedRef = useRef(muted)
  useEffect(() => {
    queueRef.current = queue
    indexRef.current = index
    volumeRef.current = volume
    mutedRef.current = muted
  }, [queue, index, volume, muted])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    const onEnded = () => {
      if (indexRef.current === null) return
      if (indexRef.current >= queueRef.current.length - 1) {
        // 队列播完停止
        setPlaying(false)
      } else {
        setIndex(indexRef.current + 1)
      }
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    // 加载/解码失败：停在暂停态、保留队列与位置（规格 §9.1，不静默跳过）
    const onError = () => setPlaying(false)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('durationchange', onLoadedMetadata)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('durationchange', onLoadedMetadata)
      audio.removeEventListener('error', onError)
      audio.pause()
    }
  }, [])

  // 曲目变化时切 src：仅在文件变更时赋值（浏览器对同值赋值也会重载媒体、进度归零）
  useEffect(() => {
    if (index === null || !audioRef.current) return
    const file = queue[index]?.file
    if (file === undefined) return
    if (currentFileRef.current !== file) {
      currentFileRef.current = file
      audioRef.current.src = file
      setCurrentTime(0)
    }
  }, [index, queue])

  // 音量/静音同步到底层音频（平台忽略程序化音量时无操作、无报错，规格 §6.4）
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
    audioRef.current.muted = muted
  }, [volume, muted])

  // 音量偏好恢复：挂载后读存储（默认值先行，避免 SSR 水合不一致）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { volume?: unknown; muted?: unknown }
      if (typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1) {
        setVolumeState(parsed.volume)
        if (parsed.volume > 0) lastVolumeRef.current = parsed.volume
      }
      if (parsed.muted === true) setMuted(true)
    } catch {
      // 存储不可用时静默降级为默认值
    }
  }, [])

  // 音量偏好持久化（队列仍不持久化，规格 §11.2）
  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume, muted }))
    } catch {
      // localStorage 不可用（如隐私模式）时静默降级，仅本次会话生效
    }
  }, [volume, muted])

  // 播放状态同步：只控制播放/暂停，不触碰 src；曲目切换后按状态恢复播放
  useEffect(() => {
    if (index === null || !audioRef.current) return
    const audio = audioRef.current
    if (playing) {
      // 自动播放被浏览器拦截时降级为暂停，不抛错
      audio.play().catch(() => setPlaying(false))
    } else {
      audio.pause()
    }
  }, [index, playing, queue])

  const playAlbum = useCallback((tracks: PlayerTrack[], start = 0) => {
    if (tracks.length === 0) return
    setQueue(tracks)
    setIndex(Math.min(Math.max(start, 0), tracks.length - 1))
    setPlaying(true)
    // 新队列从头开始：同文件重播时 src effect 会跳过赋值，显式复位进度
    setCurrentTime(0)
    if (audioRef.current) audioRef.current.currentTime = 0
  }, [])

  const toggle = useCallback(() => {
    if (indexRef.current === null) return
    setPlaying((value) => !value)
  }, [])

  const next = useCallback(() => {
    setIndex((prev) =>
      prev === null || prev >= queueRef.current.length - 1 ? prev : prev + 1,
    )
  }, [])

  const prev = useCallback(() => {
    setIndex((prev) => (prev === null || prev <= 0 ? prev : prev - 1))
  }, [])

  const clear = useCallback(() => {
    audioRef.current?.pause()
    setQueue([])
    setIndex(null)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(NaN)
  }, [])

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    const max = Number.isFinite(audio.duration) ? audio.duration : seconds
    const target = Math.min(Math.max(seconds, 0), Math.max(max, 0))
    audio.currentTime = target
    setCurrentTime(target)
  }, [])

  const setVolume = useCallback((value: number) => {
    const next = Math.min(Math.max(value, 0), 1)
    if (next > 0) lastVolumeRef.current = next
    setVolumeState(next)
    // 拖到 0 即静音表现，从 0 拉起即取消静音（规格 §6.3）
    setMuted(next === 0)
  }, [])

  const toggleMute = useCallback(() => {
    if (mutedRef.current) {
      // 取消静音：音量为 0 时恢复上次非零音量，避免无声困惑
      if (volumeRef.current === 0) {
        setVolumeState(lastVolumeRef.current > 0 ? lastVolumeRef.current : 1)
      }
      setMuted(false)
    } else {
      setMuted(true)
    }
  }, [])

  const stateValue = useMemo(
    () => ({ queue, index, playing }),
    [queue, index, playing],
  )
  const timeValue = useMemo(
    () => ({ currentTime, duration, volume, muted }),
    [currentTime, duration, volume, muted],
  )
  const actionsValue = useMemo(
    () => ({
      playAlbum,
      toggle,
      next,
      prev,
      seekTo,
      setVolume,
      toggleMute,
      clear,
    }),
    [playAlbum, toggle, next, prev, seekTo, setVolume, toggleMute, clear],
  )

  return (
    <PlayerStateContext.Provider value={stateValue}>
      <PlayerTimeContext.Provider value={timeValue}>
        <PlayerActionsContext.Provider value={actionsValue}>
          {children}
        </PlayerActionsContext.Provider>
      </PlayerTimeContext.Provider>
    </PlayerStateContext.Provider>
  )
}

export function usePlayer(): PlayerContextValue {
  const state = useContext(PlayerStateContext)
  const time = useContext(PlayerTimeContext)
  const actions = useContext(PlayerActionsContext)
  const value = useMemo(
    () => (state && time && actions ? { ...state, ...time, ...actions } : null),
    [state, time, actions],
  )
  if (!value) {
    throw new Error('usePlayer 必须在 PlayerProvider 内使用')
  }
  return value
}

export function usePlayerState(): PlayerStateValue {
  const state = useContext(PlayerStateContext)
  if (!state) {
    throw new Error('usePlayerState 必须在 PlayerProvider 内使用')
  }
  return state
}

export function usePlayerIndex(): number | null {
  return usePlayerState().index
}

export function useOptionalPlayerIndex(): number | null {
  return useContext(PlayerStateContext)?.index ?? null
}

export function usePlayerPlayback(): PlayerPlaybackValue {
  const state = useContext(PlayerStateContext)
  const actions = useContext(PlayerActionsContext)
  const value = useMemo(
    () => (state && actions ? { ...state, ...actions } : null),
    [state, actions],
  )
  if (!value) {
    throw new Error('usePlayerPlayback 必须在 PlayerProvider 内使用')
  }
  return value
}

export function useOptionalPlayer(): PlayerContextValue | null {
  const state = useContext(PlayerStateContext)
  const time = useContext(PlayerTimeContext)
  const actions = useContext(PlayerActionsContext)
  return useMemo(
    () => (state && time && actions ? { ...state, ...time, ...actions } : null),
    [state, time, actions],
  )
}

/**
 * 队列内容比较：file 序列一致即视为同一份曲目（file 为稳定 URL 标识）。
 * 不用引用比较——跨页面/跨组件实例入队后引用必不相等，会导致播放状态判断失效
 */
export function isQueueMatch(queue: PlayerTrack[], tracks: PlayerTrack[]): boolean {
  return queue.length === tracks.length && queue.every((track, i) => track.file === tracks[i].file)
}

/*
 * 专辑队列装配（album-card / album-track-list 共用）：
 * - 队列携带封面与艺术家，供全局播放条展示；引用稳定以支持「当前专辑」判断
 * - 必须在条件返回之前调用（Hooks 顺序不得依赖 props）
 */
export function useAlbumQueue(tracks: PlayerTrack[], cover?: string, artist?: string) {
  const { queue } = usePlayerState()
  const queueTracks = useMemo(
    () => tracks.map((track) => ({ ...track, cover, artist })),
    [tracks, cover, artist],
  )
  return { queueTracks, isAlbumMatch: isQueueMatch(queue, queueTracks) }
}
