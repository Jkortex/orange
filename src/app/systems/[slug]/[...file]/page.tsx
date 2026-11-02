import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSystemPackage, isContentNotFoundError, listSystemSlugs } from '@/lib/content'
import {
  findSystemFileByRoute,
  listSystemAttachments,
  systemRouteParams,
} from '@/lib/system-routes'
import { SystemPackageView } from '@/components/listing/system-package-view'

/*
 * 系统工程内的单个文件页：`/systems/<slug>/internal/raft/state.go`
 * 每个代码/配置文件都是独立静态页：
 * - 页面只编译当前文件，整包正文不进客户端（外壳见 `../layout.tsx`）
 * - 静态 HTML 被 Pagefind 逐页精准全文索引
 * - 可作为深层链接直接分享
 */

type Params = { params: Promise<{ slug: string; file: string[] }> }

export const dynamicParams = false

export function generateStaticParams() {
  const routes: Array<{ slug: string; file: string[] }> = []
  for (const slug of listSystemSlugs()) {
    const pkg = getSystemPackage(slug)
    for (const file of listSystemAttachments(pkg)) {
      routes.push({ slug, file: systemRouteParams(file.path) })
    }
  }
  if (routes.length === 0 && process.env.NODE_ENV !== 'test') {
    return [{ slug: '__empty__', file: ['__empty__'] }]
  }
  return routes
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, file } = await params
  try {
    const pkg = getSystemPackage(slug)
    const target = findSystemFileByRoute(pkg.files, file)
    if (!target) return { title: '文件不存在' }
    return {
      title: `${target.path} · ${pkg.data.title}`,
      description: pkg.data.description,
    }
  } catch (error) {
    if (isContentNotFoundError(error)) return { title: '内容不存在' }
    throw error
  }
}

export default async function SystemFileDetailPage({ params }: Params) {
  const { slug, file } = await params

  let pkg
  try {
    pkg = getSystemPackage(slug)
  } catch (error) {
    if (isContentNotFoundError(error)) notFound()
    throw error
  }

  const target = findSystemFileByRoute(pkg.files, file)
  if (!target) notFound()

  return <SystemPackageView pkg={pkg} activePath={target.path} />
}
