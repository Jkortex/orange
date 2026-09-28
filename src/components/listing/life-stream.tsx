import { LifeCard } from '@/components/listing/life-card'
import { OpenSearchButton } from '@/components/chrome/open-search-button'
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
      {/* 顶部极简信息与唤起按钮：保持页面纯净阅读感，无大表单打扰 */}
      <div className="type-caption flex items-center justify-between px-1 pb-1 text-muted-foreground">
        <span>共 {entries.length} 条生活记录 · 按时间倒序</span>

        <OpenSearchButton />
      </div>

      {/* 纯粹沉浸的生活流列表 */}
      <div className="space-y-4">
        {entries.map((entry) => (
          <LifeCard key={entry.slug} entry={entry} />
        ))}
      </div>
    </div>
  )
}
