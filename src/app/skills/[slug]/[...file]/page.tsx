import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSkillPackage, isContentNotFoundError, listSkillSlugs } from '@/lib/content'
import {
  assertSkillFileRoutes,
  findSkillFileByRoute,
  listSkillAttachments,
  skillRouteParams,
} from '@/lib/skill-routes'
import { SkillPackageView } from '@/components/listing/skill-package-view'

/*
 * 技能包内的单个文件页：`/skills/<slug>/references/pitfalls`
 * 每个附属文件都是独立静态页（而不是把全部文件塞进一个页面再靠客户端隐藏）：
 * 页面只编译一个文件，heading id 天然不重复，产物里每个文件的内容也都能被 Pagefind 索引。
 * 入口 SKILL.md 走 /skills/[slug]，不重复生成子路由。
 */

type Params = { params: Promise<{ slug: string; file: string[] }> }

export const dynamicParams = false

export function generateStaticParams() {
  const routes: Array<{ slug: string; file: string[] }> = []
  for (const slug of listSkillSlugs()) {
    const pkg = getSkillPackage(slug)
    assertSkillFileRoutes(pkg)
    for (const file of listSkillAttachments(pkg)) {
      routes.push({ slug, file: skillRouteParams(file.path) })
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
    const pkg = getSkillPackage(slug)
    const target = findSkillFileByRoute(pkg.files, file)
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

export default async function SkillFilePage({ params }: Params) {
  const { slug, file } = await params

  let pkg
  try {
    pkg = getSkillPackage(slug)
  } catch (error) {
    if (isContentNotFoundError(error)) notFound()
    throw error
  }

  const target = findSkillFileByRoute(pkg.files, file)
  if (!target) notFound()

  return (
    <div className="mx-auto w-full max-w-7xl">
      <SkillPackageView pkg={pkg} activePath={target.path} />
    </div>
  )
}
