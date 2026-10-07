import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDraft, getDrafts, isContentNotFoundError, type CollectionEntry } from '@/lib/content'
import { EntryView } from '@/components/listing/entry-view'

/*
 * 草稿详情（dev-only 专区）：复用 EntryView，回链指向 /drafts，并显示「草稿」标识。
 * 生产构建下 getDrafts() 返回空 → generateStaticParams 只产哨兵 __empty__：
 * output:'export' 下动态路由若产不出任何页面会直接构建失败（Next E1452），哨兵用于占位；
 * 该哨兵页读取草稿时抛 ContentNotFoundError → notFound()，故不含任何真实草稿内容。
 */

type Params = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  const drafts = getDrafts()
  if (drafts.length === 0) return [{ slug: '__empty__' }]
  return drafts.map(({ slug }) => ({ slug }))
}

/** 读取单条草稿，失败（不存在/非法 slug/非开发环境）转 404 */
function readDraft(slug: string): CollectionEntry<'posts'> {
  try {
    return getDraft(slug)
  } catch (error) {
    if (isContentNotFoundError(error)) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  try {
    const { data } = getDraft(slug)
    return { title: data.title, description: data.description }
  } catch (error) {
    if (isContentNotFoundError(error)) return { title: '内容不存在' }
    throw error
  }
}

export default async function DraftPage({ params }: Params) {
  const { slug } = await params
  return <EntryView entry={readDraft(slug)} backHref="/drafts" backLabel="草稿列表" draft />
}
