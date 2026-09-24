import type { CollectionType } from '@/lib/content'

/*
 * 类型徽标（AGENTS.md 界面布局规范 §4.5，首页/归档共用）：
 * 内容型文本永不图标化隐藏；未知类型防御性回退「内容」
 */

const LABELS: Record<CollectionType, string> = {
  posts: '文章',
  life: '生活',
  photos: '照片',
  music: '音乐',
  skills: '技能',
}

export function TypeBadge({ type }: { type: CollectionType }) {
  const label = LABELS[type as CollectionType] ?? '内容'
  return (
    <span className="type-caption inline-flex shrink-0 items-center rounded-full border border-border-subtle bg-muted/60 px-2 py-px font-medium tracking-wide text-muted-foreground">
      {label}
    </span>
  )
}
