'use client'

import { useMemo } from 'react'
import { Check, Copy, WrapText } from 'lucide-react'
import type { CodeLine } from '@/lib/highlight'
import { useCopyText } from '@/components/primitives/use-copy-text'

export type SystemCodeViewProps = {
  content: string
  path: string
  /** 构建期高亮结果；null（超大文件/二进制）时按纯文本逐行渲染 */
  tokens: CodeLine[] | null
  /** 折行偏好由外壳持有，切文件时不丢失 */
  wrapLines: boolean
  onToggleWrap: () => void
}

export function SystemCodeView({
  content,
  path,
  tokens,
  wrapLines,
  onToggleWrap,
}: SystemCodeViewProps) {
  const { copied, copyText } = useCopyText(2000)

  const lines = useMemo<CodeLine[]>(() => {
    if (tokens) return tokens
    // 统一处理回车符；无高亮时每行退化为单个无样式 token
    return content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => (line ? [{ content: line }] : []))
  }, [content, tokens])

  return (
    <div className="surface-card overflow-hidden rounded-xl border border-border-subtle">
      {/* 顶部工具条 */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-muted/30 px-4 py-2">
        <span className="type-caption font-mono text-muted-foreground">{path}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleWrap}
            aria-pressed={wrapLines}
            aria-label="自动折行"
            className={`type-caption flex items-center gap-1 rounded-md px-2 py-1 font-mono transition-colors ${
              wrapLines
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <WrapText className="size-3.5" aria-hidden />
            <span>折行</span>
          </button>
          <button
            type="button"
            onClick={() => copyText(content)}
            aria-label="复制代码"
            className="type-caption flex items-center gap-1 rounded-md px-2 py-1 font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-primary animate-in zoom-in-75 duration-200" aria-hidden />
                <span className="text-primary font-medium">已复制</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 代码与行号视口：token 颜色由 globals.css 按 --shiki-* 变量切换 */}
      <div className="code-tokens overflow-x-auto text-sm font-mono leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNo = idx + 1
              return (
                <tr key={lineNo} className="hover:bg-muted/40 transition-colors">
                  <td
                    aria-hidden
                    className="select-none py-0.5 pl-3 pr-4 text-right font-mono text-xs text-muted-foreground/60 w-12 align-top"
                  >
                    {lineNo}
                  </td>
                  <td
                    className={`py-0.5 pr-4 pl-1 align-top text-foreground ${
                      wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                    }`}
                  >
                    {line.length === 0
                      ? '\n'
                      : line.map((token, tokenIdx) => (
                          <span key={tokenIdx} style={token.style}>
                            {token.content}
                          </span>
                        ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
