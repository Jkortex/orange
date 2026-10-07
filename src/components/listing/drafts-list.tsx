import Link from 'next/link'
import { formatDate } from '@/lib/format'
import { EmptyState } from '@/components/primitives/empty-state'

/*
 * 草稿列表（/drafts 索引页专用）：
 * 仅本地开发可见，链接指向 /drafts/<slug>。数据由页面在服务端读取后以可序列化结构传入。
 */

export type DraftItem = {
  slug: string
  title: string
  /** ISO 字符串（date 跨 RSC 边界须序列化） */
  date: string
  description?: string
}

export function DraftsList({ drafts }: { drafts: DraftItem[] }) {
  if (drafts.length === 0) {
    return <EmptyState message="还没有草稿。把 .md 放进 content/drafts/ 后重启 pnpm dev。" />
  }

  return (
    <ul className="space-y-3">
      {drafts.map((draft) => (
        <li key={draft.slug}>
          <Link
            href={`/drafts/${draft.slug}`}
            className="surface-card surface-interactive group block p-4"
          >
            <time
              dateTime={draft.date}
              className="type-meta font-mono tabular-nums text-muted-foreground"
            >
              {formatDate(new Date(draft.date))}
            </time>
            <h2 className="type-item mt-1 font-medium text-foreground transition-colors group-hover:text-primary">
              {draft.title}
            </h2>
            {draft.description && (
              <p className="type-meta mt-1 text-muted-foreground">{draft.description}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
