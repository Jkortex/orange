import type { Metadata } from 'next'
import { Music } from 'lucide-react'
import { getCollection } from '@/lib/content'
import { AlbumCard } from '@/components/album-card'

export const metadata: Metadata = { title: '音乐' }

// 音乐：专辑网格（构建时读取，AGENTS.md 界面布局规范 §4.3）
export default function MusicPage() {
  const albums = getCollection('music')

  return (
    <section className="mx-auto w-full max-w-2xl">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-semibold">
        <Music className="size-6 text-primary" aria-hidden />
        音乐
      </h1>
      {albums.length === 0 ? (
        <p className="text-muted-foreground">还没有内容。</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
