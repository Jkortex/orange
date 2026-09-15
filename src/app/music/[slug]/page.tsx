import type { Metadata } from 'next'
import Link from 'next/link'
import { Music } from 'lucide-react'
import { getCollection } from '@/lib/content'
import { entryMetadata, readEntry } from '@/components/listing/entry-view'
import { AlbumTrackList } from '@/components/player/album-track-list'

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return getCollection('music').map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  return entryMetadata('music', slug)
}

// 专辑详情：头部信息（封面/艺术家/专辑名/年份·曲目数）+ 曲目列表（AGENTS.md 界面布局规范 §4.4）
export default async function MusicDetailPage({ params }: Params) {
  const { slug } = await params
  const entry = readEntry('music', slug)
  const { title, artist, year, cover, tracks, description } = entry.data

  return (
    <article className="mx-auto w-full max-w-2xl">
      <Link href="/music" className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary">
        ← 音乐
      </Link>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="w-40 sm:w-48">
          {cover ? (
            <img
              src={cover}
              alt={`${title} 封面`}
              className="aspect-square w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
              <Music className="size-12" aria-hidden />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{artist}</p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {[year, `${tracks.length} 首曲目`].filter((item) => item !== undefined).join(' · ')}
          </p>
          {description && <p className="mt-3 text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      <AlbumTrackList tracks={tracks} cover={cover} artist={artist} />
    </article>
  )
}
