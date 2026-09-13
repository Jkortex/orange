'use client'

import { useMemo } from 'react'
import { Pause, Play, Volume2 } from 'lucide-react'
import { isQueueMatch, usePlayer, type PlayerTrack } from './player-provider'
import { Tip } from './tip'

/*
 * 专辑曲目列表（AGENTS.md 界面布局规范 §4.4）：
 * - 「播放全部」= 专辑曲目入队起播；行内按钮支持从任一曲目起播/暂停
 * - 当前播放行 aria-current + Volume2 指示；行内按钮为图标化操作（aria-label + hover 提示）
 */

export type AlbumTrackListProps = {
  tracks: PlayerTrack[]
  cover?: string
  artist?: string
}

export function AlbumTrackList({ tracks, cover, artist }: AlbumTrackListProps) {
  const { queue, index, playing, playAlbum, toggle } = usePlayer()
  // 队列携带封面与艺术家，供全局播放条展示；引用稳定以支持「当前专辑」判断
  // （useMemo 必须在条件返回之前：Hooks 顺序不得依赖 props）
  const queueTracks = useMemo(
    () => tracks.map((track) => ({ ...track, cover, artist })),
    [tracks, cover, artist],
  )
  if (tracks.length === 0) return null

  // 内容比较（file 序列）而非引用比较：跨页面入队后仍能识别本专辑
  const isAlbumPlaying = isQueueMatch(queue, queueTracks) && playing
  const isCurrent = (i: number) => isQueueMatch(queue, queueTracks) && index === i

  return (
    <section className="mt-8">
      <button
        type="button"
        aria-label={isAlbumPlaying ? '暂停专辑' : '播放全部'}
        onClick={() => (isAlbumPlaying ? toggle() : playAlbum(queueTracks))}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {isAlbumPlaying ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {isAlbumPlaying ? '暂停' : '播放全部'}
      </button>

      <ol className="mt-4 divide-y divide-border border-y border-border">
        {tracks.map((track, i) => {
          const current = isCurrent(i)
          const label = current && playing ? '暂停' : `播放《${track.title}》`
          const rowName = `曲目 ${track.title}`
          return (
            <li
              key={track.file}
              aria-label={rowName}
              aria-current={current ? 'true' : undefined}
              className={
                current
                  ? 'flex items-center gap-3 py-3 text-primary'
                  : 'flex items-center gap-3 py-3 text-foreground'
              }
            >
              <span className="w-6 text-right text-sm text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate">{track.title}</span>
              {current && <Volume2 className="size-4 text-primary" aria-hidden />}
              <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-label={label}
                  onClick={() => (current ? toggle() : playAlbum(queueTracks, i))}
                  className="p-2.5 text-muted-foreground transition-opacity hover:text-foreground"
                >
                  {current && playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                </button>
                <Tip className="right-0 top-full mt-1.5">{label}</Tip>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
