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
      className={`surface-card group/mermaid relative my-6 overflow-hidden ${className}`}
      data-testid="mermaid-diagram"
    >
      {/* 顶部极简控制栏（原 macOS 三色点已移除，避免硬编码颜色） */}
      <div className="panel-bar flex items-center justify-between border-b border-border-subtle px-3.5 py-2 select-none">
        <span className="type-caption font-medium text-muted-foreground">{title}</span>

        <div className="flex items-center gap-1.5">
          <span className="type-caption font-mono font-semibold tracking-wider text-muted-foreground uppercase">
            Mermaid
          </span>

          {/* 切换图表 / 源码视图 */}
          {code && (
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              aria-label={showCode ? '切换为图表视图' : '查看 Mermaid 源码'}
              title={showCode ? '切换为图表视图' : '查看 Mermaid 源码'}
              className="flex size-7 items-center justify-center rounded-md border border-border-subtle bg-background/80 text-muted-foreground transition hover:text-foreground hover:bg-muted"
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
              className="flex size-7 items-center justify-center rounded-md border border-border-subtle bg-background/80 text-muted-foreground transition hover:text-foreground hover:bg-muted"
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
        <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-foreground">
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
