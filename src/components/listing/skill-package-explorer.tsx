'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileCode, FileText, File, Copy, Check, Download, Loader2 } from 'lucide-react'
import type { SkillPackage } from '@/lib/content'
import type { TocHeading } from '@/lib/toc'
import { formatDate } from '@/lib/format'
import { Toc } from '@/components/reading/toc'
import { MobileTocDrawer } from '@/components/reading/mobile-toc-drawer'
import { ReadingProgress } from '@/components/reading/reading-progress'
import { RecentTracker } from '@/components/chrome/recent-tracker'
import { DetailHeader } from '@/components/listing/detail-header'
import { useCopyText } from '@/components/primitives/use-copy-text'
import { scrollToHeading } from '@/lib/scroll'
import { skillFileHref } from '@/lib/skill-routes'

export type RenderedSkillFile = {
  path: string
  content: string | null
  headings: TocHeading[]
  node: React.ReactNode
}

export type SkillPackageExplorerProps = {
  pkg: SkillPackage
  /** 本页渲染的文件（服务端只编译这一个） */
  renderedFile: RenderedSkillFile
  activePath: string
  /** 当前页地址（最近访问记录用） */
  pageHref: string
}

function getFileIcon(path: string) {
  if (path.endsWith('.md')) return <FileText className="size-4 shrink-0 text-primary" aria-hidden />
  if (path.endsWith('.json') || path.endsWith('.ts') || path.endsWith('.js') || path.endsWith('.sh')) {
    return <FileCode className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  }
  return <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />
}

export function SkillPackageExplorer({
  pkg,
  renderedFile,
  activePath,
  pageHref,
}: SkillPackageExplorerProps) {
  const { copied, copyText } = useCopyText(2000)
  const [downloading, setDownloading] = useState(false)

  const currentFile = renderedFile
  const hasFiles = pkg.files.length > 1
  const headings = currentFile.headings

  async function copyCurrentContent() {
    if (!currentFile.content) return
    await copyText(currentFile.content)
  }

  async function handleDownloadZip() {
    if (downloading) return
    try {
      setDownloading(true)
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const rootFolder = zip.folder(pkg.data.name) ?? zip
      for (const file of pkg.files) {
        if (file.content !== null) {
          rootFolder.file(file.path, file.content)
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${pkg.data.name}${pkg.data.version ? `-v${pkg.data.version}` : ''}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('打包下载失败', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <article id="skill-top" className="w-full animate-in fade-in-50 duration-300">
      <ReadingProgress />

      {/* 记录当前文件到最近访问 */}
      <RecentTracker url={pageHref} title={pkg.data.title} />

      {/* 顶部 Header 区块：动态返回链接与技能信息、下载按钮 */}
      <DetailHeader
        backHref="/"
        backLabel="首页"
        title={pkg.data.title}
        meta={
          <>
            <code className="type-caption rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-foreground">
              {pkg.data.name}
            </code>
              {pkg.data.version !== undefined && <span className="font-mono">v{pkg.data.version}</span>}
              {pkg.data.author !== undefined && <span>· {pkg.data.author}</span>}
              <span>·</span>
              <time dateTime={pkg.data.date.toISOString()} className="font-mono">
              {formatDate(pkg.data.date)}
            </time>
          </>
        }
        tags={pkg.data.tags}
        description={pkg.data.description}
        divided
        actions={
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={downloading}
            aria-label="下载技能包"
            className="type-meta inline-flex shrink-0 items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 font-medium text-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-surface-hover disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            ) : (
              <Download className="size-4 text-primary" aria-hidden />
            )}
            <span>{downloading ? '正在打包…' : '下载技能包 (.zip)'}</span>
          </button>
        }
      />

      {/* 核心工作区：三栏栅格从正文首行平齐起跑，左侧文件树 + 中间正文 + 右侧 TOC */}
      <div className="grid w-full gap-6 md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)_13rem] md:gap-8">
        {/* 左侧文件导航 (桌面端)：每个文件是独立静态页 */}
        <aside className="hidden md:block">
          <div className="sticky top-20 md:sticky md:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <nav
              aria-label="技能导航"
              className="surface-card space-y-4 p-3"
            >
              {hasFiles && (
                <div>
                    <p className="type-caption mb-2 px-2 font-semibold uppercase tracking-wider text-muted-foreground">
                      文件
                    </p>
                  <ol className="space-y-1">
                    {pkg.files.map((file) => {
                      const isActive = file.path === activePath
                      return (
                        <li key={file.path}>
                          <Link
                            href={skillFileHref(pkg.slug, file.path)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`type-meta flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono transition-colors ${
                              isActive
                                ? 'bg-primary/10 font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            {getFileIcon(file.path)}
                            <span className="truncate">{file.path}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}
              {/* 中等屏 (< lg) 下将当前目录也收在左侧导航内 */}
              {headings.length > 0 && (
                <div className="border-t border-border-subtle pt-3 lg:hidden">
                    <p className="type-caption mb-2 px-2 font-semibold uppercase tracking-wider text-muted-foreground">
                      目录
                    </p>
                  <ol className="space-y-1.5">
                    {headings.map((heading) => (
                      <li key={heading.id} className={heading.depth === 3 ? 'ml-3' : undefined}>
                        <a
                          href={`#${heading.id}`}
                          onClick={(e) => {
                            e.preventDefault()
                            scrollToHeading(heading.id)
                          }}
                          className="type-meta block truncate text-muted-foreground hover:text-foreground"
                        >
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </nav>
          </div>
        </aside>

        {/* 中间核心正文 */}
        <div className="min-w-0">
          {/* 移动端横向滑动文件选项卡 (< md) */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 md:hidden">
            {pkg.files.map((file) => {
              const isActive = file.path === activePath
              return (
                <Link
                  key={file.path}
                  href={skillFileHref(pkg.slug, file.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`type-meta flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono transition-colors ${
                    isActive
                      ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                      : 'border-border-subtle bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {getFileIcon(file.path)}
                  {file.path}
                </Link>
              )
            })}
          </div>

          <div className="surface-float mb-5 flex items-center justify-between px-3.5 py-2.5">
            <span className="type-meta flex items-center gap-2 font-mono font-medium text-foreground">
              {getFileIcon(currentFile.path)}
              {currentFile.path}
            </span>
            {currentFile.content !== null && (
              <button
                type="button"
                onClick={copyCurrentContent}
                className="type-meta flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-primary animate-in zoom-in-75 duration-200" aria-hidden />
                    <span className="text-primary font-medium">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" aria-hidden />
                    <span>复制源码</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* 本页只渲染当前文件：不会残留隐藏 DOM，也不会出现跨文件重复 heading id */}
          {currentFile.node ? (
            currentFile.node
          ) : currentFile.content !== null ? (
            <pre className="surface-card overflow-x-auto p-4 text-sm font-mono">
              <code>{currentFile.content}</code>
            </pre>
          ) : (
            <p className="type-meta text-muted-foreground">二进制文件，仅列出路径：{currentFile.path}</p>
          )}
        </div>

        {/* 右侧当前文件目录 (仅大屏 lg: 显示) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            {headings.length > 0 ? (
              <Toc headings={headings} />
            ) : (
              <div className="surface-card border-dashed type-meta p-4 text-center text-muted-foreground">
                本文档无子章节
              </div>
            )}
          </div>
        </aside>

        {/* 移动端目录抽屉 */}
        <MobileTocDrawer headings={headings} />
      </div>
    </article>
  )
}
