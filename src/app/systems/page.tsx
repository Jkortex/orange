import type { Metadata } from 'next'
import { Cpu } from 'lucide-react'
import { getSystemEntries } from '@/lib/content'
import { SystemsExplorer, type SystemItem } from '@/components/listing/systems-explorer'
import { PageHeader } from '@/components/listing/page-header'

export const metadata: Metadata = {
  title: '系统',
  description: '完整系统设计与工程代码实现浏览。',
}

export default function SystemsPage() {
  const systems: SystemItem[] = getSystemEntries().map((entry) => ({
    slug: entry.slug,
    title: entry.data.title,
    date: entry.data.date.toISOString(),
    name: entry.data.name,
    language: entry.data.language,
    architecture: entry.data.architecture,
    category: entry.data.category,
    description: entry.data.description,
    tags: entry.data.tags,
  }))

  return (
    <div className="mx-auto w-full max-w-5xl animate-in fade-in-50 duration-300">
      <PageHeader
        title="系统"
        description="完整系统设计与工程代码实现，包含核心状态机、协议实现与轻量架构。"
        icon={<Cpu aria-hidden />}
      />
      <SystemsExplorer systems={systems} />
    </div>
  )
}
