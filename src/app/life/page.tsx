import type { Metadata } from 'next'
import { getCollection } from '@/lib/content'
import { PageHeader } from '@/components/listing/page-header'
import { LifeStream } from '@/components/listing/life-stream'

export const metadata: Metadata = {
  title: '生活',
  description: '碎碎念、随手拍与日常记录',
}

export default function LifePage() {
  const entries = getCollection('life')

  return (
    <div className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <PageHeader
        title="生活"
        description="日常碎片、即兴随笔与随手记录。"
      />
      <div className="mt-6">
        <LifeStream entries={entries} />
      </div>
    </div>
  )
}
