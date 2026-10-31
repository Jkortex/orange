'use client'

import { useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useHotkey } from '@tanstack/react-hotkeys'
import type { TocHeading } from '@/lib/toc'
import { scrollToHeading } from '@/lib/scroll'
import { buildGeminiExplainPrompt, explainWithGemini } from '@/lib/gemini-explain'

/*
 * 文内目录：
 * - 纯客户端响应式高亮当前阅读位置（IntersectionObserver）
 * - 桌面端可在右侧 sticky 悬浮，移动端可嵌入在正文前
 * - 激活项胶囊微底色 + 悬浮位移微动效，提升长文导航沉浸感
 * - AI 解释支持：可单选或复选多个小节，一键生成提示词并转到 Gemini 解释；
 *   支持键盘快捷键 G 快速唤起解释。
 *
 * 滚动契约（长目录，如 35 节）：滚动发生在卡片**内部**，只有列表滚动，
 * 卡片头部（「目录 · N 节」）与圆角/描边固定不动。故卡片是 flex 纵向：
 * 头部 shrink-0，列表 min-h-0 + flex-1 + overflow-y-auto；高度上限由调用方经
 * className 传入（如 max-h-[calc(100vh-var(--header-height)-3rem)]）。
 * 调用方不要再在外层容器上加 overflow-y-auto —— 那会让整张卡片（含头部与边框）一起滚走。
 *
 * 列表只允许纵向滚动：overflow-y-auto 会把 overflow-x 一并算成 auto，稍有溢出（如激活项
 * hover 的 translate-x-0.5）就冒出横向滚动条，故显式 overflow-x-hidden。pr-2 把滚动条
 * 从文字旁推开一点，避免贴着标题文字。
 */

export function Toc({
  headings,
  articleTitle,
  className = '',
}: {
  headings: TocHeading[]
  articleTitle?: string
  className?: string
}) {
  const [activeId, setActiveId] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<string>('')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || headings.length === 0) return

    // 监听标题可见性，动态高亮当前小节
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px' },
    )

    for (const heading of headings) {
      const el = document.getElementById(heading.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  // 快捷键 G：将选中章节（或当前激活章节）转到 Gemini 解释
  useHotkey('G', () => {
    if (document.querySelector('[role="dialog"]') !== null) return
    triggerExplain()
  })

  if (headings.length === 0) return null

  function handleHeadingClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault()
    // 滚动 + hash 同步收敛到 scrollToHeading；高亮态本地维护
    if (scrollToHeading(id)) setActiveId(id)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function selectAll() {
    if (selectedIds.size === headings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(headings.map((h) => h.id)))
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function triggerExplain(targetHeadings?: string[]) {
    let titlesToExplain = targetHeadings

    if (!titlesToExplain || titlesToExplain.length === 0) {
      if (selectedIds.size > 0) {
        titlesToExplain = headings
          .filter((h) => selectedIds.has(h.id))
          .map((h) => h.text)
      } else if (activeId) {
        const current = headings.find((h) => h.id === activeId)
        titlesToExplain = [current ? current.text : headings[0].text]
      } else {
        titlesToExplain = [headings[0].text]
      }
    }

    const prompt = buildGeminiExplainPrompt({
      articleTitle,
      headings: titlesToExplain,
    })

    const copied = await explainWithGemini(prompt)
    setFeedback(copied ? '已复制提示词并前往 Gemini' : '正在前往 Gemini…')
    window.setTimeout(() => setFeedback(''), 2500)
  }

  return (
    <nav
      aria-label="文章目录"
      className={`surface-card flex flex-col p-3.5 ${className}`}
    >
      {/* 头部：固定不滚动 */}
      <div className="mb-2.5 flex shrink-0 items-center justify-between px-1">
        <p className="type-caption font-semibold uppercase tracking-wider text-muted-foreground">
          目录
        </p>
        <span className="type-caption font-mono text-muted-foreground">
          {headings.length} 节
        </span>
      </div>

      {/* 列表：可滚动，支持多选勾选与跳转 */}
      <ol className="relative min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden pr-2 border-l border-border-subtle pl-2.5">
        {headings.map((heading) => {
          const isActive = activeId === heading.id
          const isSelected = selectedIds.has(heading.id)

          return (
            <li
              key={heading.id}
              className={`group/item flex items-center gap-1.5 ${
                heading.depth === 3 ? 'ml-4' : ''
              }`}
            >
              {/* 复选框：支持选择一个或复数个标题 */}
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`选择章节：${heading.text}`}
                onClick={() => toggleSelect(heading.id)}
                className={`size-4 shrink-0 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-subtle hover:border-primary/60 text-transparent'
                }`}
              >
                <Check
                  className={`size-3 stroke-[3] transition-opacity ${
                    isSelected ? 'opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden="true"
                />
              </button>

              {/* 标题链接 */}
              <a
                href={`#${heading.id}`}
                onClick={(e) => handleHeadingClick(e, heading.id)}
                className={`group flex min-w-0 flex-1 items-center rounded-md px-1.5 py-1.5 type-meta transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5'
                }`}
              >
                <span className="truncate">{heading.text}</span>
              </a>

              {/* 单节快捷解释入口（悬停/聚焦时可见） */}
              <button
                type="button"
                aria-label={`Gemini 解释「${heading.text}」`}
                onClick={() => triggerExplain([heading.text])}
                className="size-6 shrink-0 rounded opacity-0 group-hover/item:opacity-100 focus:opacity-100 hover:bg-muted text-muted-foreground hover:text-primary transition-all flex items-center justify-center cursor-pointer"
              >
                <Sparkles className="size-3" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ol>

      {/* 底部操作面板：有勾选标题时展示，支持一键 Gemini 解释与清空 */}
      {selectedIds.size > 0 && (
        <div className="shrink-0 pt-2.5 mt-2 border-t border-border-subtle space-y-2 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between type-caption text-muted-foreground px-1">
            <span>
              已选 <strong className="font-mono text-foreground">{selectedIds.size}</strong> 节
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs hover:text-foreground transition-colors cursor-pointer"
              >
                {selectedIds.size === headings.length ? '取消全选' : '全选'}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs hover:text-foreground transition-colors cursor-pointer"
              >
                清空
              </button>
            </div>
          </div>

          <button
            type="button"
            aria-label="转到 Gemini 解释选中小节"
            onClick={() => triggerExplain()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 type-meta font-medium transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Gemini 解释</span>
            <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 py-0.5 font-mono text-[10px] uppercase">
              G
            </kbd>
          </button>

          {feedback && (
            <p className="type-caption text-center text-primary animate-in fade-in duration-150">
              {feedback}
            </p>
          )}
        </div>
      )}
    </nav>
  )
}
