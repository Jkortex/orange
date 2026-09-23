'use client'

import { Pause, Play, Volume2 } from 'lucide-react'
import { useAlbumQueue, usePlayer, type PlayerTrack } from '@/components/player/player-provider'
import { IconButton } from '@/components/primitives/icon-button'

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
  const { index, playing, playAlbum, toggle } = usePlayer()
  // 队列装配与「当前专辑」判断收敛到 useAlbumQueue（引用稳定，跨页面可比）
  const { queueTracks, isAlbumMatch } = useAlbumQueue(tracks, cover, artist)
  if (tracks.length === 0) return null

  // 内容比较（file 序列）而非引用比较：跨页面入队后仍能识别本专辑
  const isAlbumPlaying = isAlbumMatch && playing
  const isCurrent = (i: number) => isAlbumMatch && index === i

  return (
    <section className="mt-8">
      <button
        type="button"
        aria-label={isAlbumPlaying ? '暂停专辑' : '播放全部'}
        onClick={() => (isAlbumPlaying ? toggle() : playAlbum(queueTracks))}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:brightness-[1.05]"
      >
        {isAlbumPlaying ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {isAlbumPlaying ? '暂停' : '播放全部'}
      </button>

      <ol className="mt-4 overflow-hidden rounded-xl border border-border/70 divide-y divide-border/50">
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
              <span className="w-6 text-right font-mono text-[13px] tabular-nums text-muted-foreground/70">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 truncate text-[15px] font-medium tracking-tight">{track.title}</span>
              {current && <Volume2 className="size-4 shrink-0 text-primary" aria-hidden />}
              <IconButton
                label={label}
                onClick={() => (current ? toggle() : playAlbum(queueTracks, i))}
                buttonClassName="rounded-full p-2.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
                tipClassName="right-0 top-full mt-1.5"
              >
                {current && playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              </IconButton>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
