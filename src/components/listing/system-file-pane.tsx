'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Code2, Copy, FileCode, FileText } from 'lucide-react'
import type { CodeLine } from '@/lib/highlight'
import type { TocHeading } from '@/lib/toc'
import { Toc } from '@/components/reading/toc'
import { MobileTocDrawer } from '@/components/reading/mobile-toc-drawer'
import { useCopyText } from '@/components/primitives/use-copy-text'
import { SystemCodeView } from '@/components/listing/system-code-view'
import { useSystemViewPrefs } from '@/components/listing/system-shell'
import { systemFileHref } from '@/lib/system-routes'

/*
 * 单个文件的内容面板（由各文件页渲染，位于常驻外壳的中间栏）：
 * - 移动端横滑文件栏 + 文件信息条 + 正文/代码
 * - 右侧为当前文件 TOC 或系统指标
 * - 切换文件时保持文档滚动位置，只在读者已滚过面板顶部时才把面板顶对齐顶栏
 */

export type RenderedSystemFile = {
  path: string
  content: string | null
  headings: TocHeading[]
  node: React.ReactNode
  /** 构建期高亮结果（超大文件为 null，退回纯文本） */
  tokens: CodeLine[] | null
}

export type SystemFilePaneProps = {
  slug: string
  file: RenderedSystemFile
  filePaths: string[]
  title: string
  metrics: {
    language?: string
    fileCount: number
    lineCount: number
  }
}

function getFileIcon(path: string) {
  if (path.endsWith('.md')) return <FileText className="size-4 shrink-0 text-primary" aria-hidden />
  return <FileCode className="size-4 shrink-0 text-muted-foreground" aria-hidden />
}

export function SystemFilePane({ slug, file, filePaths, title, metrics }: SystemFilePaneProps) {
  const { wrapLines, toggleWrapLines } = useSystemViewPrefs()
  const { copied, copyText } = useCopyText(2000)
  const [showMarkdownSource, setShowMarkdownSource] = useState(false)
  const paneRef = useRef<HTMLDivElement>(null)

  const isMarkdown = file.path.endsWith('.md')
  const headings = file.headings

  // 切文件后若读者已滚到面板内部，就把面板顶对齐顶栏；首屏 scrollY 为 0，不会跳。
  useEffect(() => {
    const el = paneRef.current
    if (!el) return
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height')
    const headerHeight = Number.parseFloat(raw) || 64
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 16
    if (top > 0 && window.scrollY > top) window.scrollTo({ top, behavior: 'instant' })
  }, [file.path])

  async function copyCurrentContent() {
    if (!file.content) return
    await copyText(file.content)
  }

  return (
    <>
      <div ref={paneRef} className="min-w-0">
        {/* 移动端横向滑动文件栏 (< md) */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 md:hidden">
          {filePaths.map((path) => {
            const isActive = path === file.path
            return (
              <Link
                key={path}
                href={systemFileHref(slug, path)}
                scroll={false}
                aria-current={isActive ? 'page' : undefined}
                className={`type-meta flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono transition-colors ${
                  isActive
                    ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                    : 'border-border-subtle bg-surface text-muted-foreground hover:text-foreground'
                }`}
              >
                {getFileIcon(path)}
                {path}
              </Link>
            )
          })}
        </div>

        {/* 文件信息与视图切换 */}
        <div className="surface-float mb-4 flex items-center justify-between px-3.5 py-2">
          <div className="flex items-center gap-2 truncate">
            {getFileIcon(file.path)}
            <span className="type-meta truncate font-mono font-medium text-foreground">
              {file.path}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isMarkdown && file.node && (
              <button
                type="button"
                onClick={() => setShowMarkdownSource(!showMarkdownSource)}
                className="type-caption flex items-center gap-1 rounded-md px-2 py-1 font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Code2 className="size-3.5" aria-hidden />
                <span>{showMarkdownSource ? '阅读文档' : '查看源码'}</span>
              </button>
            )}
            {file.content !== null && (
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
        {isMarkdown && file.node && !showMarkdownSource ? (
          <div className="surface-card p-6 md:p-8">{file.node}</div>
        ) : file.content !== null ? (
          <SystemCodeView
            content={file.content}
            path={file.path}
            tokens={file.tokens}
            wrapLines={wrapLines}
            onToggleWrap={toggleWrapLines}
          />
        ) : (
          <div className="surface-card p-8 text-center text-muted-foreground">
            二进制或大文件，仅列出路径：{file.path}
          </div>
        )}
      </div>

      {/* 右侧系统概览与 TOC (仅大屏 lg: 显示) */}
      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--header-height)+1.5rem)] space-y-4">
          {headings.length > 0 && !showMarkdownSource ? (
            <Toc
              headings={headings}
              articleTitle={title}
              className="max-h-[calc(100vh-var(--header-height)-3rem)]"
            />
          ) : (
            <div className="surface-card space-y-3 p-4">
              <p className="type-caption font-semibold uppercase tracking-wider text-muted-foreground">
                系统指标
              </p>
              <dl className="space-y-2 text-sm">
                {metrics.language && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">核心语言</dt>
                    <dd className="font-mono font-medium text-foreground">{metrics.language}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">文件总数</dt>
                  <dd className="font-mono text-foreground">{metrics.fileCount} 个</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">代码总行数</dt>
                  <dd className="font-mono text-foreground">约 {metrics.lineCount} 行</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </aside>

      {/* 移动端目录抽屉 */}
      <MobileTocDrawer headings={headings} articleTitle={title} />
    </>
  )
}
