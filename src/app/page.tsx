import Link from 'next/link'
import { Newspaper } from 'lucide-react'
import { getRecentEntries, type CollectionEntry, type CollectionType } from '@/lib/content'
import { TypeBadge } from '@/components/type-badge'
import { formatDate } from '@/lib/format'

// 类型守卫：泛型 union 无法按 collection 字面量自动窄化，显式收窄到音乐条目
function isMusic(entry: CollectionEntry<CollectionType>): entry is CollectionEntry<'music'> {
  return entry.collection === 'music'
}

// 首页：统一混合时间线（AGENTS.md 界面布局规范第 6 条），全类型按日期倒序取最近 10 条
export default function HomePage() {
  const entries = getRecentEntries(10)

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div className="mb-10 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">你好，这里是 Orange 🍊</h1>
        <p className="text-muted-foreground">
          记录编程技术、生活随想与音乐专辑的个人数字空间。
        </p>
      </div>

      <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
        <Newspaper className="size-5 text-primary" aria-hidden />
        最近更新
      </h2>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">还没有内容。</p>
      ) : (
        <ol className="space-y-4">
          {entries.map((entry) => (
            <li key={`${entry.collection}/${entry.slug}`} className="flex items-start gap-3">
              <TypeBadge type={entry.collection} />
              <div className="min-w-0 flex-1">
                {isMusic(entry) ? (
                  <Link href={`/music/${entry.slug}`} className="flex items-center gap-3">
                    {entry.data.cover && (
                      <img
                        src={entry.data.cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-12 shrink-0 rounded-md border border-border object-cover"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium hover:text-primary">
                        {entry.data.title}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {entry.data.artist}
                        {entry.data.year !== undefined && ` · ${entry.data.year}`}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <>
                    <Link
                      href={`/${entry.collection}/${entry.slug}`}
                      className="font-medium hover:text-primary"
                    >
                      {entry.data.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      <time dateTime={entry.data.date.toISOString()}>
                        {formatDate(entry.data.date)}
                      </time>
                      {entry.data.tags.length > 0 && (
                        <span> · {entry.data.tags.join(' / ')}</span>
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
