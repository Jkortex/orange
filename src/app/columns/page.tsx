import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BookOpen,
  ArrowRight,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  Compass,
} from 'lucide-react'
import { PageHeader } from '@/components/listing/page-header'
import { getAllColumns, PLANNED_COLUMNS } from '@/lib/column-data'

export const metadata: Metadata = {
  title: '专栏中心',
  description: '体系化、实战导向的深度技术专栏与云原生架构进阶体系。',
}

export default function ColumnsPage() {
  const columns = getAllColumns()

  return (
    <div className="mx-auto w-full max-w-5xl animate-in fade-in-50 duration-300">
      <PageHeader
        title="专栏中心"
        description="体系化、工程导向的深度技术专栏与知识进阶体系。"
        icon={<BookOpen aria-hidden />}
      />

      {/* 已发布精选专栏列表 */}
      <section className="space-y-8">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Layers className="size-5 text-primary" aria-hidden />
          <h2 className="type-title">精选实战专栏</h2>
          <span className="type-meta text-muted-foreground font-mono">
            ({columns.length})
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {columns.map((col) => (
            <article
              key={col.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md sm:p-8"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-primary/15 font-medium text-primary">
                    {col.badge}
                  </span>
                  <span className="chip chip-subtle flex items-center gap-1 font-mono">
                    <CheckCircle2 className="size-3 text-primary" aria-hidden />
                    {col.statusText}
                  </span>
                  <span className="chip chip-subtle">{col.focus ?? '全栈实践'}</span>
                  <span className="chip chip-subtle font-mono">
                    {col.updatedAt} 更新
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="type-display text-2xl tracking-tight text-foreground group-hover:text-primary transition-colors sm:text-3xl">
                    <Link href={`/columns/${col.id}`}>
                      {col.title}
                    </Link>
                  </h3>
                  <p className="type-item font-medium text-muted-foreground">
                    {col.subtitle}
                  </p>
                </div>

                <p className="type-body line-clamp-3 text-muted-foreground leading-relaxed">
                  {col.description}
                </p>

                {/* 专栏四大核心维度 */}
                <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-4">
                  {col.highlights.map((h) => (
                    <div
                      key={h.title}
                      className="rounded-lg border border-border-subtle bg-muted/30 p-2.5 transition-colors group-hover:bg-muted/50"
                    >
                      <div className="type-meta font-semibold text-foreground">
                        {h.title}
                      </div>
                      <p className="type-meta line-clamp-2 text-muted-foreground">
                        {h.desc}
                      </p>
                    </div>
                  ))}
                </div>

                {/* 标签 */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {col.tags.map((tag) => (
                    <span key={tag} className="chip chip-subtle text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* 底部跳转入口 */}
              <div className="mt-6 flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="type-meta text-muted-foreground font-mono">
                  共 {col.phases.length} 个学习阶段
                </div>

                <Link
                  href={`/columns/${col.id}`}
                  className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:self-auto"
                >
                  <span>查看专栏大纲与路线图</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 筹备规划中专栏（预留扩展） */}
      <section className="mt-16 space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Sparkles className="size-5 text-muted-foreground" aria-hidden />
          <h2 className="type-title text-muted-foreground">更多专栏筹备中</h2>
          <span className="type-meta text-muted-foreground font-mono">
            ({PLANNED_COLUMNS.length})
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLANNED_COLUMNS.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-xl border border-dashed border-border bg-card/60 p-5"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="chip chip-subtle font-mono text-xs">
                    <Clock className="size-3" aria-hidden />
                    {p.badge}
                  </span>
                  <span className="type-meta font-mono text-muted-foreground">
                    {p.statusText}
                  </span>
                </div>

                <h3 className="type-item font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="type-meta text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-4">
                {p.tags.map((tag) => (
                  <span key={tag} className="chip chip-subtle text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
