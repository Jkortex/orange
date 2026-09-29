import type { Metadata } from 'next'
import { Newspaper } from 'lucide-react'
import { getCollection } from '@/lib/content'
import { PostsExplorer, type PostItem } from '@/components/listing/posts-explorer'
import { PageHeader } from '@/components/listing/page-header'

export const metadata: Metadata = { title: '文章' }

// 站点根 = 文章列表：左侧分类列表（构建期由内容聚合）+ 右侧条目列表，默认「全部」= 按日期倒序。
// 数据构建期内嵌进客户端组件，切换分类纯客户端过滤，不发内容请求（AGENTS.md 内容与渲染纪律）
export default function PostsPage() {
  const posts: PostItem[] = getCollection('posts').map((entry) => ({
    slug: entry.slug,
    title: entry.data.title,
    date: entry.data.date.toISOString(),
    category: entry.data.category,
  }))

  return (
    <div className="mx-auto w-full max-w-5xl animate-in fade-in-50 duration-300">
      <PageHeader
        title="文章"
        description="技术笔记、实践记录与经验总结。"
        icon={<Newspaper aria-hidden />}
      />
      <PostsExplorer posts={posts} />
    </div>
  )
}
