'use client'

import { useRef, type ComponentProps } from 'react'
import { Check, Copy } from 'lucide-react'
import { useCopyText } from '@/components/primitives/use-copy-text'

export function CodeBlock({ children, className = '', ...props }: ComponentProps<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null)
  const { copied, copyText } = useCopyText(2000)
  const lang = (props as Record<string, unknown>)['data-language'] as string | undefined

  async function onCopy() {
    if (!preRef.current) return
    const text = preRef.current.innerText ?? preRef.current.textContent ?? ''
    await copyText(text)
  }

  return (
    <div className="group/code relative my-6 overflow-hidden rounded-xl border border-border-subtle bg-muted/40">
      {/* 极简顶栏：仅语言标识徽章（原 macOS 三色点已移除，避免硬编码颜色） */}
      {lang && (
        <div className="flex items-center border-b border-border-subtle bg-muted/60 px-3.5 py-2 select-none">
          <span className="type-caption font-mono font-medium tracking-wider text-muted-foreground uppercase">
            {lang}
          </span>
        </div>
      )}

      <pre
        ref={preRef}
        className={`overflow-x-auto p-4 font-mono text-sm leading-relaxed ${className}`}
        {...props}
      >
        {children}
      </pre>

      {/* 复制代码按钮：悬浮平滑淡入 + 变色反馈 */}
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? '已复制' : '复制代码'}
        className="absolute right-2.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-md border border-border/60 bg-card/80 text-muted-foreground opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover/code:opacity-100 focus:opacity-100 hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-primary animate-in zoom-in-75 duration-200" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  )
}
