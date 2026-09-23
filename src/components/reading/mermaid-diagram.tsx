'use client'

import { useState } from 'react'
import { Check, Copy, Code2, Eye } from 'lucide-react'
import { useCopyText } from '@/components/primitives/use-copy-text'

export interface MermaidDiagramProps {
  svg?: string
  code?: string
  title?: string
  className?: string
  node?: unknown
}

export function MermaidDiagram({
  svg,
  code = '',
  title = '流程架构图',
  className = '',
}: MermaidDiagramProps) {
  const [showCode, setShowCode] = useState(false)
  const { copied, copyText } = useCopyText(2000)

  if (!svg && !code) return null

  return (
    <div
      className={`group/mermaid relative my-6 overflow-hidden rounded-xl border border-border/80 bg-card/60 ${className}`}
      data-testid="mermaid-diagram"
    >
      {/* 顶部极简控制栏 */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/40 px-3.5 py-2 text-xs select-none">
        <div className="flex items-center gap-2">
          {/* macOS 风格三态微指示点 */}
          <div className="flex items-center gap-1.5 opacity-60" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-red-400/80 dark:bg-red-500/60" />
            <span className="size-2.5 rounded-full bg-amber-400/80 dark:bg-amber-500/60" />
            <span className="size-2.5 rounded-full bg-emerald-400/80 dark:bg-emerald-500/60" />
          </div>
          <span className="font-medium text-muted-foreground/90">{title}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            Mermaid
          </span>

          {/* 切换图表 / 源码视图 */}
          {code && (
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              aria-label={showCode ? '切换为图表视图' : '查看 Mermaid 源码'}
              title={showCode ? '切换为图表视图' : '查看 Mermaid 源码'}
              className="flex size-7 items-center justify-center rounded-md border border-border/50 bg-background/80 text-muted-foreground transition hover:text-foreground hover:bg-muted"
            >
              {showCode ? (
                <Eye className="size-3.5" aria-hidden />
              ) : (
                <Code2 className="size-3.5" aria-hidden />
              )}
            </button>
          )}

          {/* 复制代码 */}
          {code && (
            <button
              type="button"
              onClick={() => copyText(code)}
              aria-label={copied ? '已复制' : '复制图表代码'}
              title={copied ? '已复制' : '复制图表代码'}
              className="flex size-7 items-center justify-center rounded-md border border-border/50 bg-background/80 text-muted-foreground transition hover:text-foreground hover:bg-muted"
            >
              {copied ? (
                <Check className="size-3.5 text-primary animate-in zoom-in-75 duration-200" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 主体渲染区 */}
      {showCode ? (
        <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-foreground bg-muted/30">
          <code>{code}</code>
        </pre>
      ) : svg ? (
        <div
          className="flex justify-center items-center overflow-x-auto p-6 md:p-8"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
    </div>
  )
}
