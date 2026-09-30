import type { Metadata } from 'next'
import { getCollection } from '@/lib/content'
import { entryMetadata, readEntry, EntryView } from '@/components/listing/entry-view'

type Params = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  const entries = getCollection('life')
  if (entries.length === 0) return [{ slug: '__empty__' }]
  return entries.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  return entryMetadata('life', slug)
}

export default async function LifeDetailPage({ params }: Params) {
  const { slug } = await params
  const entry = readEntry('life', slug)

  return <EntryView entry={entry} />
}
