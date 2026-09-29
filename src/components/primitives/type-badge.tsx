import type { CollectionType } from '@/lib/content'

/*
 * 类型徽标（分类 / 标签页共用；搜索结果复用同一 LABELS 映射）：
 * 内容型文本永不图标化隐藏；未知类型防御性回退「内容」
 */

export const LABELS: Record<CollectionType, string> = {
  posts: '文章',
  life: '生活',
  music: '音乐',
  skills: '技能',
}

export function TypeBadge({ type }: { type: CollectionType }) {
  const label = LABELS[type as CollectionType] ?? '内容'
  return (
    <span className="chip shrink-0">
      {label}
    </span>
  )
}
