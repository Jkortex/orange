'use client'

import { useState } from 'react'
import JSZip from 'jszip'
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

export type RenderedSkillFile = {
  path: string
  content: string | null
  headings: TocHeading[]
  node: React.ReactNode
}

export type SkillPackageExplorerProps = {
  pkg: SkillPackage
  renderedFiles: RenderedSkillFile[]
}

function getFileIcon(path: string) {
  if (path.endsWith('.md')) return <FileText className="size-4 shrink-0 text-primary" aria-hidden />
  if (path.endsWith('.json') || path.endsWith('.ts') || path.endsWith('.js') || path.endsWith('.sh')) {
    return <FileCode className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  }
  return <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />
}

export function SkillPackageExplorer({ pkg, renderedFiles }: SkillPackageExplorerProps) {
  const [activePath, setActivePath] = useState<string>('SKILL.md')
  const { copied, copyText } = useCopyText(2000)
  const [downloading, setDownloading] = useState(false)

  const currentFile = renderedFiles.find((f) => f.path === activePath) ?? renderedFiles[0]
  const attachments = pkg.files.filter((file) => file.path !== 'SKILL.md')
  const hasFiles = attachments.length > 0
  const headings = currentFile?.headings ?? []

  async function copyCurrentContent() {
    const text = currentFile?.path === 'SKILL.md' ? pkg.body : currentFile?.content
    if (!text) return
    await copyText(text)
  }

  async function handleDownloadZip() {
    if (downloading) return
    try {
      setDownloading(true)
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

      {/* 记录当前技能包到最近访问 */}
      <RecentTracker url={`/skills/${pkg.slug}`} title={pkg.data.title} />

      {/* 顶部 Header 区块：动态返回链接与技能信息、下载按钮 */}
      <DetailHeader
        backHref="/"
        backLabel="首页"
        title={pkg.data.title}
        meta={
          <>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground font-medium">
              {pkg.data.name}
            </code>
              {pkg.data.version !== undefined && <span className="font-mono text-[13px]">v{pkg.data.version}</span>}
              {pkg.data.author !== undefined && <span>· {pkg.data.author}</span>}
              <span>·</span>
              <time dateTime={pkg.data.date.toISOString()} className="font-mono text-[13px]">
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
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/80 hover:shadow-md disabled:opacity-50"
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
        {/* 左侧文件导航 (桌面端) */}
        <aside className="hidden md:block">
          <div className="sticky top-20 md:sticky md:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <nav
              aria-label="技能导航"
              className="space-y-4 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs backdrop-blur-sm"
            >
              {hasFiles && (
                <div>
                    <p className="mb-2 px-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                      文件
                    </p>
                  <ol className="space-y-1 text-sm">
                    {renderedFiles.map((file) => (
                      <li key={file.path}>
                        <button
                          type="button"
                          onClick={() => setActivePath(file.path)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[13px] transition-colors ${
                            activePath === file.path
                              ? 'bg-primary/15 font-medium text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {getFileIcon(file.path)}
                          <span className="truncate">{file.path}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {/* 中等屏 (< lg) 下将当前目录也收在左侧导航内 */}
              {headings.length > 0 && (
                <div className="lg:hidden border-t border-border pt-3">
                    <p className="mb-2 px-2 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                      目录
                    </p>
                  <ol className="space-y-1.5 text-sm">
                    {headings.map((heading) => (
                      <li key={heading.id} className={heading.depth === 3 ? 'ml-3' : undefined}>
                        <a
                          href={`#${heading.id}`}
                          onClick={(e) => {
                            e.preventDefault()
                            scrollToHeading(heading.id)
                          }}
                          className="block truncate text-[13px] text-muted-foreground hover:text-foreground"
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
            {renderedFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setActivePath(file.path)}
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-mono transition-colors ${
                  activePath === file.path
                    ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {getFileIcon(file.path)}
                {file.path}
              </button>
            ))}
          </div>

          <div className="mb-5 flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-3.5 py-2.5 shadow-2xs backdrop-blur-sm">
            <span className="flex items-center gap-2 font-mono text-[13px] font-medium text-foreground/80">
              {getFileIcon(currentFile.path)}
              {currentFile.path}
            </span>
            {currentFile.content !== null && (
              <button
                type="button"
                onClick={copyCurrentContent}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
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

          {renderedFiles.map((file) => {
            const isCurrent = file.path === activePath
            return (
              <section
                key={file.path}
                className={isCurrent ? 'block' : 'hidden'}
                aria-hidden={!isCurrent}
              >
                {file.node ? (
                  file.node
                ) : file.content !== null ? (
                  <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm font-mono">
                    <code>{file.content}</code>
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">二进制文件，仅列出路径：{file.path}</p>
                )}
              </section>
            )
          })}
        </div>

        {/* 右侧当前文件目录 (仅大屏 lg: 显示) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            {headings.length > 0 ? (
              <Toc headings={headings} />
            ) : (
              <div className="rounded-md border border-border/50 bg-muted/20 p-4 text-center text-[13px] text-muted-foreground">
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
