import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSystemPackage, isContentNotFoundError, listSystemSlugs } from '@/lib/content'
import { SystemPackageView } from '@/components/listing/system-package-view'

type Params = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  const slugs = listSystemSlugs()
  if (slugs.length === 0) return [{ slug: '__empty__' }]
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  try {
    const { data } = getSystemPackage(slug)
    return { title: data.title, description: data.description }
  } catch (error) {
    if (isContentNotFoundError(error)) return { title: '内容不存在' }
    throw error
  }
}

export default async function SystemDetailPage({ params }: Params) {
  const { slug } = await params
  let pkg
  try {
    pkg = getSystemPackage(slug)
  } catch (error) {
    if (isContentNotFoundError(error)) notFound()
    throw error
  }

  return <SystemPackageView pkg={pkg} />
}
