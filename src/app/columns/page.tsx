import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Layers, ArrowRight, CheckCircle2, Cpu, ShieldCheck, Terminal, Compass } from 'lucide-react'
import { PageHeader } from '@/components/listing/page-header'
import { DISTRIBUTED_GO_COLUMN } from '@/lib/column-data'

export const metadata: Metadata = {
  title: '专栏',
  description: '体系化、实战导向的深度技术专栏与云原生实战指南。',
}

const HIGHLIGHT_ICONS = [Cpu, Compass, ShieldCheck, Terminal]

export default function ColumnsPage() {
  const col = DISTRIBUTED_GO_COLUMN

  return (
    <div className="mx-auto w-full max-w-5xl animate-in fade-in-50 duration-300">
      <PageHeader
        title="专栏"
        description="体系化、工程导向的深度技术专栏与知识进阶指南。"
        icon={<BookOpen aria-hidden />}
      />

      {/* 专栏头图卡片 */}
      <section className="mb-12 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-primary/15 font-medium text-primary">
              {col.badge}
            </span>
            <span className="chip chip-subtle">全栈实践</span>
            <span className="chip chip-subtle">Go 1.22+</span>
          </div>

          <h2 className="type-display tracking-tight text-foreground sm:text-3xl">
            {col.title}
          </h2>

          <p className="type-item font-medium text-muted-foreground">
            {col.subtitle}
          </p>

          <p className="type-body text-muted-foreground">
            {col.description}
          </p>

          {/* 核心亮点矩阵 */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {col.highlights.map((item, idx) => {
              const Icon = HIGHLIGHT_ICONS[idx % HIGHLIGHT_ICONS.length]
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-border-subtle bg-muted/40 p-4 transition-colors hover:bg-muted/70"
                >
                  <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="type-meta font-semibold">{item.title}</span>
                  </div>
                  <p className="type-meta text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 专栏进阶路线与完整目录 */}
      <div className="space-y-12">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <Layers className="size-5 text-primary" aria-hidden />
          <h3 className="type-title">专栏全景路线图与目录（共 17 篇）</h3>
        </div>

        {col.phases.map((phase, pIndex) => (
          <section key={phase.name} className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h4 className="type-item flex items-center gap-2 font-semibold text-foreground">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                  {pIndex + 1}
                </span>
                {phase.name}
              </h4>
              <p className="type-meta text-muted-foreground">
                {phase.description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {phase.chapters.map((ch) => (
                <Link
                  key={ch.slug}
                  href={`/posts/${ch.slug}`}
                  className="group relative flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/50 hover:bg-muted/30 sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip font-mono text-xs font-semibold text-primary">
                        {ch.chapterNumber}
                      </span>
                      <span className="type-item font-medium transition-colors group-hover:text-primary">
                        {ch.title}
                      </span>
                    </div>

                    <p className="type-meta line-clamp-2 text-muted-foreground leading-relaxed">
                      {ch.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ch.tags.map((tag) => (
                        <span key={tag} className="chip chip-subtle text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 font-mono text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary sm:self-center">
                    <span>阅读本篇</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
