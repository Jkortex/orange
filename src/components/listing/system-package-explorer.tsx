'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Check,
  Code2,
  Copy,
  Download,
  FileCode,
  FileText,
  File,
  GitBranch,
  Loader2,
} from 'lucide-react'
import type { SystemPackage } from '@/lib/content'
import type { TocHeading } from '@/lib/toc'
import { formatDate } from '@/lib/format'
import { Toc } from '@/components/reading/toc'
import { MobileTocDrawer } from '@/components/reading/mobile-toc-drawer'
import { ReadingProgress } from '@/components/reading/reading-progress'
import { DetailHeader } from '@/components/listing/detail-header'
import { ReadingControls } from '@/components/reading/reading-controls'
import { useCopyText } from '@/components/primitives/use-copy-text'
import { SystemFileTree } from '@/components/listing/system-file-tree'
import { SystemCodeView } from '@/components/listing/system-code-view'
import { systemFileHref } from '@/lib/system-routes'

export type RenderedSystemFile = {
  path: string
  content: string | null
  headings: TocHeading[]
  node: React.ReactNode
}

export type SystemPackageExplorerProps = {
  pkg: SystemPackage
  renderedFile: RenderedSystemFile
  activePath: string
}

function getFileIcon(path: string) {
  if (path.endsWith('.md')) return <FileText className="size-4 shrink-0 text-primary" aria-hidden />
  return <FileCode className="size-4 shrink-0 text-muted-foreground" aria-hidden />
}

export function SystemPackageExplorer({
  pkg,
  renderedFile,
  activePath,
}: SystemPackageExplorerProps) {
  const { copied, copyText } = useCopyText(2000)
  const [downloading, setDownloading] = useState(false)
  const [showMarkdownSource, setShowMarkdownSource] = useState(false)

  const currentFile = renderedFile
  const isMarkdown = currentFile.path.endsWith('.md')
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
      console.error('工程打包下载失败', err)
    } finally {
      setDownloading(false)
    }
  }

  // 统计代码指标
  const totalFiles = pkg.files.length
  const totalLines = pkg.files.reduce((acc, f) => acc + (f.lineCount ?? 0), 0)

  return (
    <article id="system-top" className="w-full animate-in fade-in-50 duration-300">
      <ReadingProgress />

      {/* 顶部 Header 区块 */}
      <DetailHeader
        backHref="/systems"
        backLabel="系统列表"
        title={pkg.data.title}
        meta={
          <>
            <code className="type-caption rounded bg-muted px-1.5 py-0.5 font-mono font-medium text-foreground">
              {pkg.data.name}
            </code>
            {pkg.data.language && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                {pkg.data.language}
              </span>
            )}
            {pkg.data.architecture && (
              <span className="type-caption text-muted-foreground">
                架构: {pkg.data.architecture}
              </span>
            )}
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
          <div className="flex flex-wrap items-center gap-2">
            {pkg.data.repoUrl && (
              <a
                href={pkg.data.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="type-meta inline-flex shrink-0 items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2 font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
              >
                <GitBranch className="size-4" aria-hidden />
                <span>源码仓库</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={downloading}
              aria-label="下载工程源码"
              className="type-meta inline-flex shrink-0 items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-2 font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
              ) : (
                <Download className="size-4 text-primary" aria-hidden />
              )}
              <span>{downloading ? '正在打包…' : '下载源码 (.zip)'}</span>
            </button>
          </div>
        }
      />

      {/* 三栏工作台主体 */}
      <div className="grid w-full gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)_13rem] md:gap-8">
        {/* 左侧文件树导航 (桌面端) */}
        <aside className="hidden md:block">
          <div className="sticky top-[calc(var(--header-height)+1.5rem)] max-h-[calc(100vh-var(--header-height)-3rem)] overflow-y-auto pr-1">
            <div className="surface-card space-y-3 p-3">
              <div className="flex items-center justify-between px-1">
                <p className="type-caption font-semibold uppercase tracking-wider text-muted-foreground">
                  工程目录
                </p>
                <span className="type-caption text-xs text-muted-foreground/80">
                  {totalFiles} 个文件
                </span>
              </div>
              <SystemFileTree tree={pkg.tree} slug={pkg.slug} activePath={activePath} />
            </div>
          </div>
        </aside>

        {/* 中间核心代码/正文工作区 */}
        <div className="min-w-0">
          {/* 移动端横向滑动文件栏 (< md) */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 md:hidden">
            {pkg.files.map((file) => {
              const isActive = file.path === activePath
              return (
                <Link
                  key={file.path}
                  href={systemFileHref(pkg.slug, file.path)}
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

          {/* 顶栏文件信息与视图切换 */}
          <div className="surface-float mb-4 flex items-center justify-between px-3.5 py-2">
            <div className="flex items-center gap-2 truncate">
              {getFileIcon(currentFile.path)}
              <span className="type-meta truncate font-mono font-medium text-foreground">
                {currentFile.path}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isMarkdown && currentFile.node && (
                <button
                  type="button"
                  onClick={() => setShowMarkdownSource(!showMarkdownSource)}
                  className="type-caption flex items-center gap-1 rounded-md px-2 py-1 font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Code2 className="size-3.5" aria-hidden />
                  <span>{showMarkdownSource ? '阅读文档' : '查看源码'}</span>
                </button>
              )}
              {currentFile.content !== null && (
                <button
                  type="button"
                  onClick={copyCurrentContent}
                  className="type-caption flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check
                        className="size-3.5 text-primary animate-in zoom-in-75 duration-200"
                        aria-hidden
                      />
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
          </div>

          {/* 当前文件正文或代码渲染 */}
          {isMarkdown && currentFile.node && !showMarkdownSource ? (
            <div className="surface-card p-6 md:p-8">{currentFile.node}</div>
          ) : currentFile.content !== null ? (
            <SystemCodeView content={currentFile.content} path={currentFile.path} />
          ) : (
            <div className="surface-card p-8 text-center text-muted-foreground">
              二进制或大文件，仅列出路径：{currentFile.path}
            </div>
          )}
        </div>

        {/* 右侧系统概览与 TOC (仅大屏 lg: 显示) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height)+1.5rem)] space-y-4">
            {headings.length > 0 && !showMarkdownSource ? (
              <Toc headings={headings} className="max-h-[calc(100vh-var(--header-height)-3rem)]" />
            ) : (
              <div className="surface-card space-y-3 p-4">
                <p className="type-caption font-semibold uppercase tracking-wider text-muted-foreground">
                  系统指标
                </p>
                <dl className="space-y-2 text-sm">
                  {pkg.data.language && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">核心语言</dt>
                      <dd className="font-mono font-medium text-foreground">{pkg.data.language}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">文件总数</dt>
                    <dd className="font-mono text-foreground">{totalFiles} 个</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">代码总行数</dt>
                    <dd className="font-mono text-foreground">约 {totalLines} 行</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </aside>

        {/* 移动端目录抽屉 */}
        <MobileTocDrawer headings={headings} />
      </div>

      <ReadingControls />
    </article>
  )
}
