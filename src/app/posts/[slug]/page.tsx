import type { Metadata } from 'next'
import { getCollection } from '@/lib/content'
import { entryMetadata, readEntry, EntryView } from '@/lib/entry-view'

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return getCollection('posts').map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  return entryMetadata('posts', slug)
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params
  const entry = readEntry('posts', slug)

  return <EntryView entry={entry} />
}
