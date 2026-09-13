'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { loadPagefind, type PagefindResultItem } from '@/lib/pagefind'
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import { Tip } from './tip'

/*
 * 站内搜索（AGENTS.md 界面布局规范）：顶栏图标按钮（满足图标化三判据，aria-label + hover/focus 提示）
 * + Ctrl/Cmd+K 全局快捷键 + Modal 结果列表。结果由构建期 Pagefind 索引提供，语义 token 渲染
 * （不引入 Pagefind UI 默认样式）。对话框行为（focus trap / Esc / 遮罩关闭）由 Radix Dialog 接管。
 */

type Result = { url: string; title: string; excerpt: string }

const tooltipPosition = 'left-1/2 top-full mt-1.5 -translate-x-1/2'

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[] | null>(null) // null = 未搜索
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // 竞态守卫：连按键盘时仅保留最后一次请求的结果
  const seqRef = useRef(0)

  // Ctrl/Cmd+K 开关（全局）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 打开时聚焦输入框（Radix 默认聚焦首个可聚焦元素即输入框，此为双保险）
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function handleInput(value: string) {
    setQuery(value)
    const seq = ++seqRef.current
    if (!value.trim()) {
      setResults(null)
      setError(null)
      return
    }
    try {
      const pagefind = await loadPagefind()
      if (seq !== seqRef.current) return // 已有更新的输入
      if (!pagefind) {
        setResults(null)
        setError('搜索索引不可用，请先完成构建。')
        return
      }
      const res = await pagefind.search(value)
      if (seq !== seqRef.current) return
      const items: PagefindResultItem[] = await Promise.all(res.results.map((r) => r.data()))
      if (seq !== seqRef.current) return
      setError(null)
      setResults(
        items.map((it) => ({
          url: it.url,
          title: it.meta?.title ?? it.url,
          excerpt: it.excerpt ?? '',
        })),
      )
    } catch {
      if (seq !== seqRef.current) return
      setResults(null)
      setError('搜索出错，请稍后再试。')
    }
  }

  const iconBtnClass =
    'group relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="搜索"
          aria-keyshortcuts="Control+K Meta+K"
          className={iconBtnClass}
        >
          <Search className="size-5" aria-hidden />
          <Tip className={tooltipPosition}>搜索</Tip>
        </button>
      </DialogTrigger>
      <DialogOverlay data-testid="search-backdrop" />
      <DialogContent
        aria-label="站内搜索"
        showCloseButton={false}
        className="top-24 max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
      >
        {/* Radix Dialog 要求可访问名称：aria-label 替代 Title（视觉标题会破坏搜索框形态） */}
        <DialogTitle className="sr-only">站内搜索</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="搜索文章、专辑…"
            aria-label="搜索关键词"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            aria-label="关闭搜索"
            onClick={() => setOpen(false)}
            className={iconBtnClass}
          >
            <X className="size-4" aria-hidden />
            <Tip className={tooltipPosition}>关闭</Tip>
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {error ? (
            <p className="p-4 text-sm text-muted-foreground">{error}</p>
          ) : results === null ? (
            <p className="p-4 text-sm text-muted-foreground">输入关键词搜索全站内容。</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">没有找到相关内容。</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.url}>
                  {/* 摘要为构建期本地索引生成的富文本（<mark> 高亮），内容源为自有文章，无第三方注入 */}
                  <a href={r.url} className="block rounded-md p-3 transition-colors hover:bg-primary/10">
                    <span className="block font-medium">{r.title}</span>
                    <span
                      className="mt-1 block text-sm text-muted-foreground [&>mark]:bg-primary/20 [&>mark]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: r.excerpt }}
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
