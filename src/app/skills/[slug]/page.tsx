import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSkillPackage, isContentNotFoundError, listSkillSlugs } from '@/lib/content'
import { SkillPackageView } from '@/components/listing/skill-package-view'

type Params = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return listSkillSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  try {
    const { data } = getSkillPackage(slug)
    return { title: data.title, description: data.description }
  } catch (error) {
    if (isContentNotFoundError(error)) return { title: '内容不存在' }
    throw error
  }
}

// 技能详情：包目录即导航，纯服务端渲染
export default async function SkillPage({ params }: Params) {
  const { slug } = await params
  let pkg
  try {
    pkg = getSkillPackage(slug)
  } catch (error) {
    if (isContentNotFoundError(error)) notFound()
    throw error
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <SkillPackageView pkg={pkg} />
    </div>
  )
}
