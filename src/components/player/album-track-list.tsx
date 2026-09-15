'use client'

import { useMemo } from 'react'
import { Pause, Play, Volume2 } from 'lucide-react'
import { isQueueMatch, usePlayer, type PlayerTrack } from '@/components/player/player-provider'
import { Tip } from '@/components/primitives/tip'

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
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-all duration-200 hover:-translate-y-px hover:shadow-sm hover:brightness-[1.03] active:translate-y-0 active:scale-[0.98]"
      >
        {isAlbumPlaying ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {isAlbumPlaying ? '暂停' : '播放全部'}
      </button>

      <ol className="mt-4 overflow-hidden rounded-xl border border-border/70">
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
                  ? 'flex items-center gap-3 bg-primary/[0.07] px-3 py-2.5 text-primary'
                  : 'flex items-center gap-3 bg-card/40 px-3 py-2.5 text-foreground transition-colors hover:bg-muted/50'
              }
            >
              <span className="w-6 text-right font-mono text-xs tabular-nums text-muted-foreground/70">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 truncate text-[15px] font-medium tracking-tight">{track.title}</span>
              {current && <Volume2 className="size-4 shrink-0 text-primary" aria-hidden />}
              <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-label={label}
                  onClick={() => (current ? toggle() : playAlbum(queueTracks, i))}
                  className="rounded-full p-2.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
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
