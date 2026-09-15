import Link from 'next/link'
import { Newspaper } from 'lucide-react'
import { getRecentEntries, type CollectionEntry, type CollectionType } from '@/lib/content'
import { TypeBadge } from '@/components/primitives/type-badge'
import { EmptyState } from '@/components/primitives/empty-state'
import { formatDate } from '@/lib/format'

// 类型守卫：泛型 union 无法按 collection 字面量自动窄化，显式收窄到音乐条目
function isMusic(entry: CollectionEntry<CollectionType>): entry is CollectionEntry<'music'> {
  return entry.collection === 'music'
}

// 首页：统一混合时间线（AGENTS.md 界面布局规范第 6 条），全类型按日期倒序取最近 10 条
export default function HomePage() {
  const entries = getRecentEntries(10)

  return (
    <section className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <div className="mb-10 space-y-3">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[13px] font-medium text-muted-foreground shadow-xs">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          个人数字空间 · 编程 / 生活 / 音乐
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl sm:leading-[1.15]">你好，这里是 Orange 🍊</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          记录编程技术、生活随想与音乐专辑的个人数字空间。
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Newspaper className="size-3.5 text-primary" aria-hidden />
          </span>
          最近更新
        </h2>
        <span className="font-mono text-[13px] tabular-nums text-muted-foreground/70">{entries.length} 篇</span>
      </div>
      {entries.length === 0 ? (
        <EmptyState message="还没有内容。" />
      ) : (
        <ol className="divide-y divide-border/60 border-y border-border/60">
          {entries.map((entry) => (
            <li key={`${entry.collection}/${entry.slug}`} className="group flex items-start gap-3 px-3 py-3.5 transition-colors duration-200 hover:bg-muted/40 sm:mx-[-0.75rem] sm:rounded-xl sm:border sm:border-transparent sm:hover:border-border/60 sm:hover:bg-card sm:hover:shadow-xs">
              <span className="pt-0.5">
                <TypeBadge type={entry.collection} />
              </span>
              <div className="min-w-0 flex-1">
                {isMusic(entry) ? (
                  <Link href={`/music/${entry.slug}`} className="flex items-center gap-3">
                    {entry.data.cover && (
                      <img
                        src={entry.data.cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-12 shrink-0 rounded-lg border border-border/60 object-cover shadow-xs ring-1 ring-black/[0.04] transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium tracking-tight transition-colors group-hover:text-primary">
                        {entry.data.title}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {entry.data.artist}
                        {entry.data.year !== undefined && ` · ${entry.data.year}`}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <>
                    <Link
                      href={`/${entry.collection}/${entry.slug}`}
                      className="block truncate font-medium tracking-tight transition-colors group-hover:text-primary"
                    >
                      {entry.data.title}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <time dateTime={entry.data.date.toISOString()} className="tabular-nums">
                        {formatDate(entry.data.date)}
                      </time>
                      {entry.data.tags.length > 0 && (
                        <span className="truncate"> · {entry.data.tags.join(' / ')}</span>
                      )}
                    </p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
