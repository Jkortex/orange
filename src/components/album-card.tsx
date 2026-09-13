'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Music, Pause, Play } from 'lucide-react'
import { isQueueMatch, usePlayer, type PlayerTrack } from './player-provider'
import { Tip } from './tip'

/*
 * 专辑卡（AGENTS.md 界面布局规范 §4.3）：
 * - 整卡可点进详情（stretched-link：标题链接的 ::after 铺满卡片），hover 时浮现播放按钮
 * - 播放按钮独立于链接之外（交互元素不得嵌套），z-10 保证可点
 * - 播放按钮为图标化操作（通用隐喻/紧凑卡片/非值展示），aria-label + hover 提示一致
 * - 封面即控制：本专辑在队列中时按钮切为暂停形态，点击暂停/恢复而非重设队列
 */

export type AlbumCardProps = {
  slug: string
  title: string
  artist: string
  year?: number
  cover?: string
  tracks: PlayerTrack[]
}

export function AlbumCard({ slug, title, artist, year, cover, tracks }: AlbumCardProps) {
  const { queue, playing, playAlbum, toggle } = usePlayer()
  // 队列携带封面与艺术家，供全局播放条展示
  const queueTracks = useMemo(
    () => tracks.map((track) => ({ ...track, cover, artist })),
    [tracks, cover, artist],
  )
  // 内容比较（file 序列）而非引用比较：跨页面入队后仍能识别本专辑
  const current = isQueueMatch(queue, queueTracks)
  const playingThis = current && playing
  const playLabel = playingThis ? `暂停专辑《${title}》` : `播放专辑《${title}》`

  return (
    <li className="group relative">
      {/* 封面容器不裁剪溢出，保证播放按钮 tooltip 完整显示 */}
      <div className="relative">
        <div className="aspect-square overflow-hidden rounded-md border border-border">
          {cover ? (
            <img
              src={cover}
              alt={`${title} 封面`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <Music className="size-10" aria-hidden />
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label={playLabel}
          onClick={() => (current ? toggle() : playAlbum(queueTracks))}
          className="absolute bottom-2 right-2 z-10 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
        >
          {playingThis ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          <Tip className="-top-8 right-0">{playLabel}</Tip>
        </button>
      </div>
      <h2 className="mt-2 font-medium">
        {/* stretched-link：::after 铺满最近的定位祖先（li），整卡可点 */}
        <Link href={`/music/${slug}`} className="hover:text-primary after:absolute after:inset-0">
          {title}
        </Link>
      </h2>
      <p className="text-sm text-muted-foreground">
        {artist}
        {year !== undefined && ` · ${year}`}
      </p>
    </li>
  )
}
