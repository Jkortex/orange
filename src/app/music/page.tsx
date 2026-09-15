import type { Metadata } from 'next'
import { Music } from 'lucide-react'
import { getCollection } from '@/lib/content'
import { AlbumCard } from '@/components/player/album-card'

export const metadata: Metadata = { title: '音乐' }

// 音乐：专辑网格（构建时读取，AGENTS.md 界面布局规范 §4.3）
export default function MusicPage() {
  const albums = getCollection('music')

  return (
    <section className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <div className="mb-8 space-y-2">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Music className="size-4 text-primary" aria-hidden />
          </span>
          音乐
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          一篇内容即一张专辑 · 点击封面进入详情，不进详情页也可直接播放。
        </p>
      </div>
      {albums.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">还没有内容。</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
          {albums.map((album) => (
            <AlbumCard
              key={album.slug}
              slug={album.slug}
              title={album.data.title}
              artist={album.data.artist}
              year={album.data.year}
              cover={album.data.cover}
              tracks={album.data.tracks}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
