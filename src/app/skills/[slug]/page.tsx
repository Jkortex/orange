import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSkillPackage, listSkillSlugs } from '@/lib/content'
import { SkillPackageView } from '@/components/skill-package-view'

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return listSkillSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  try {
    const { data } = getSkillPackage(slug)
    return { title: data.title, description: data.description }
  } catch {
    return { title: '内容不存在' }
  }
}

// 技能详情：包目录即导航（docs/specs/content-model.md §7），纯服务端渲染
export default async function SkillPage({ params }: Params) {
  const { slug } = await params
  let pkg
  try {
    pkg = getSkillPackage(slug)
  } catch {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <SkillPackageView pkg={pkg} />
    </div>
  )
}
