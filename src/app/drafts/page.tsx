import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FilePenLine } from 'lucide-react'
import { getDrafts, isDraftsEnabled } from '@/lib/content'
import { PageHeader } from '@/components/listing/page-header'
import { DraftsList } from '@/components/listing/drafts-list'

/*
 * 草稿索引（dev-only 专区）：
 * - 生产构建直接 notFound()：草稿仅在本地开发可见，绝不进入产物（双保险，getDrafts 在非 dev 下本就返回空）
 * - 草稿不注册进 collectionSchemas / TAGGED_TYPES，故 sitemap / rss / tags / categories / Pagefind 均不可见
 */

export const metadata: Metadata = { title: '草稿' }

export default function DraftsPage() {
  if (!isDraftsEnabled()) notFound()

  const drafts = getDrafts().map((entry) => ({
    slug: entry.slug,
    title: entry.data.title,
    date: entry.data.date.toISOString(),
    description: entry.data.description,
  }))

  return (
    <div className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <PageHeader
        title="草稿"
        description="仅本地可见；审阅通过后移入 content/posts/。"
        icon={<FilePenLine aria-hidden />}
      />
      <DraftsList drafts={drafts} />
    </div>
  )
}
