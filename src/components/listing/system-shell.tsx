'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, GitBranch } from 'lucide-react'
import type { SystemPackageOutline } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { DetailHeader } from '@/components/listing/detail-header'
import { ReadingControls } from '@/components/reading/reading-controls'
import { ReadingProgress } from '@/components/reading/reading-progress'
import { SystemFileTree } from '@/components/listing/system-file-tree'
import { activeSystemPath, systemDownloadHref } from '@/lib/system-routes'

/*
 * 系统工程常驻外壳（挂在 `systems/[slug]/layout.tsx`）：
 * 同 layout 下切换文件页时本组件不重挂载，因此
 * - 文件树的展开状态、代码折行偏好不会丢失；
 * - 页面滚动位置不被路由重置（文件链接统一 scroll={false}）；
 * - 淡入动画只在进入工程时播一次，不再制造"整页刷新"的观感。
 */

type SystemViewPrefs = {
  wrapLines: boolean
  toggleWrapLines: () => void
}

const SystemViewContext = createContext<SystemViewPrefs | null>(null)

export function useSystemViewPrefs(): SystemViewPrefs {
  const prefs = useContext(SystemViewContext)
  if (!prefs) throw new Error('useSystemViewPrefs 必须在 SystemShell 内使用')
  return prefs
}

export function SystemShell({
  outline,
  children,
}: {
  outline: SystemPackageOutline
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const activePath = useMemo(
    () => activeSystemPath(pathname, outline.slug),
    [pathname, outline.slug],
  )
  const [wrapLines, setWrapLines] = useState(false)
  const prefs = useMemo<SystemViewPrefs>(
    () => ({ wrapLines, toggleWrapLines: () => setWrapLines((prev) => !prev) }),
    [wrapLines],
  )

  const { data } = outline

  return (
    <article id="system-top" className="w-full animate-in fade-in-50 duration-300">
      <ReadingProgress />

      <DetailHeader
        backHref="/systems"
        backLabel="系统列表"
        title={data.title}
        meta={
          <>
            <code className="type-caption rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-foreground">
              {data.name}
            </code>
            {data.language && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                {data.language}
              </span>
            )}
            {data.architecture && (
              <span className="type-caption text-muted-foreground">架构: {data.architecture}</span>
            )}
            <span>·</span>
            <time dateTime={data.date.toISOString()} className="font-mono">
              {formatDate(data.date)}
            </time>
          </>
        }
        tags={data.tags}
        description={data.description}
        divided
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.repoUrl && (
              <a
                href={data.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="type-meta inline-flex shrink-0 items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2 font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
              >
                <GitBranch className="size-4" aria-hidden />
                <span>源码仓库</span>
              </a>
            )}
            <a
              href={systemDownloadHref(outline.slug)}
              download
              aria-label="下载工程源码"
              className="type-meta inline-flex shrink-0 items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-2 font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
            >
              <Download className="size-4 text-primary" aria-hidden />
              <span>下载源码 (.zip)</span>
            </a>
          </div>
        }
      />

      <SystemViewContext.Provider value={prefs}>
        <div className="grid w-full gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8 lg:grid-cols-[15rem_minmax(0,1fr)_13rem]">
          {/* 左侧文件树导航 (桌面端)：常驻，展开状态跨文件切换保留 */}
          <aside className="hidden md:block">
            <div className="sticky top-[calc(var(--header-height)+1.5rem)] max-h-[calc(100vh-var(--header-height)-3rem)] overflow-y-auto pr-1">
              <div className="surface-card space-y-3 p-3">
                <div className="flex items-center justify-between px-1">
                  <p className="type-caption font-semibold uppercase tracking-wider text-muted-foreground">
                    工程目录
                  </p>
                  <span className="type-caption text-xs text-muted-foreground/80">
                    {outline.fileCount} 个文件
                  </span>
                </div>
                <SystemFileTree
                  tree={outline.tree}
                  slug={outline.slug}
                  activePath={activePath}
                />
              </div>
            </div>
          </aside>

          {children}
        </div>
      </SystemViewContext.Provider>

      <ReadingControls />
    </article>
  )
}
