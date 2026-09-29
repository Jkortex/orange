'use client'

import { useState } from 'react'
import { Check, Copy, Code2, Eye } from 'lucide-react'
import { useCopyText } from '@/components/primitives/use-copy-text'
import { MermaidCanvas } from '@/components/reading/mermaid-canvas'
import { MediaZoom } from '@/components/reading/media-zoom'

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
        /*
         * 画布外包一层放大查看触发按钮：图表窄屏自适应后细节仍难辨，放大是刚需。
         * 只在图表视图套 —— 源码视图是一段 <pre>，不该出现「点击放大」的假承诺。
         *
         * 画布必须是**块级**、且不能带 overflow-x-auto：
         * - 生成的 SVG 根标签带写死的 width/height，而 flex 子项的 min-width:auto 会取内容宽
         *   把它撑住不缩，max-width:100% 也救不回来 —— 窄屏只能横向滚，这正是要修的病根
         * - 自适应生效后本就不会溢出，留着 overflow-x-auto 反而可能在触发按钮里嵌进一个
         *   被 a11y-scrollable 注入 tabindex 的可聚焦滚动区，语义更糟
         * 居中交给 globals.css 的 .mermaid-canvas > svg { margin-inline: auto }
         *
         * 画布是 MermaidCanvas 而非裸 span：它还会在挂载后量一次 bbox、把上游偏心约 1.5%
         * 的 viewBox 收紧回中心（见 lib/mermaid-viewbox.ts），否则正文与浮层里的图都偏右
         */
        <MediaZoom
          source={{ kind: 'svg', svg, alt: title }}
          label={`放大查看：${title}`}
          hint="点击放大"
          className="block w-full"
        >
          <MermaidCanvas svg={svg} className="mermaid-canvas block p-6 md:p-8" />
        </MediaZoom>
      ) : null}
    </div>
  )
}
