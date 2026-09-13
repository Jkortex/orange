import type { Metadata } from 'next'
import { getCollection } from '@/lib/content'
import { PostsExplorer, type PostItem } from '@/components/posts-explorer'

export const metadata: Metadata = { title: '文章' }

// 文章页：左侧分类列表（构建期由内容聚合）+ 右侧条目列表，默认「最近」= 全部按日期倒序。
// 数据构建期内嵌进客户端组件，切换分类纯客户端过滤，不发内容请求（AGENTS.md 内容与渲染纪律）
export default function PostsPage() {
  const posts: PostItem[] = getCollection('posts').map((entry) => ({
    slug: entry.slug,
    title: entry.data.title,
    date: entry.data.date.toISOString(),
    category: entry.data.category,
  }))

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold">文章</h1>
      <PostsExplorer posts={posts} />
    </div>
  )
}
