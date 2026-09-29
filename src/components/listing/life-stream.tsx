import { LifeCard } from '@/components/listing/life-card'
import { EmptyState } from '@/components/primitives/empty-state'
import type { CollectionEntry } from '@/lib/content'

export interface LifeStreamProps {
  entries: CollectionEntry<'life'>[]
}

export function LifeStream({ entries }: LifeStreamProps) {
  if (entries.length === 0) {
    return <EmptyState message="暂无生活记录" />
  }

  return (
    <div className="space-y-4">
      {/* 顶部极简信息：保持页面纯净阅读感。检索走顶栏全局搜索（Ctrl/Cmd+K），不在页内重复入口 */}
      <p className="type-caption px-1 pb-1 text-muted-foreground">
        共 {entries.length} 条生活记录 · 按时间倒序
      </p>

      {/* 纯粹沉浸的生活流列表 */}
      <div className="space-y-4">
        {entries.map((entry) => (
          <LifeCard key={entry.slug} entry={entry} />
        ))}
      </div>
    </div>
  )
}
