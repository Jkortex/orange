'use client'

import { useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useHotkey } from '@tanstack/react-hotkeys'
import type { TocHeading } from '@/lib/toc'
import { scrollToHeading } from '@/lib/scroll'
import {
  AI_PROVIDER_EVENT,
  AI_PROVIDERS,
  buildAiExplainPrompt,
  explainWithAi,
  getAiProvider,
  setAiProvider,
  type AiProvider,
  type AiProviderEventDetail,
} from '@/lib/ai-explain'

/*
 * 文内目录：
 * - 纯客户端响应式高亮当前阅读位置（IntersectionObserver）
 * - 桌面端可在右侧 sticky 悬浮，移动端可嵌入在正文前
 * - 激活项胶囊微底色 + 悬浮位移微动效，提升长文导航沉浸感
 * - AI 解释支持：可单选或复选多个小节，一键生成提示词并转到 DeepSeek（默认）或 Gemini 解释；
 *   支持用户自由切换 AI 引擎，支持键盘快捷键 G 快速唤起解释。
 *
 * 滚动契约（长目录，如 35 节）：滚动发生在卡片内部，只有列表滚动，
 * 卡片头部（「目录 · N 节」）与圆角/描边固定不动。
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
  const [aiProvider, setAiProviderState] = useState<AiProvider>('deepseek')

  useEffect(() => {
    setAiProviderState(getAiProvider())

    function onProviderChange(e: Event) {
      const detail = (e as CustomEvent<AiProviderEventDetail>).detail
      if (detail?.provider) {
        setAiProviderState(detail.provider)
      }
    }

    window.addEventListener(AI_PROVIDER_EVENT, onProviderChange)
    return () => window.removeEventListener(AI_PROVIDER_EVENT, onProviderChange)
  }, [])

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

  // 快捷键 G：将选中章节（或当前激活章节）转到当前 AI 引擎解释
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

  function switchProvider(next: AiProvider) {
    setAiProvider(next)
    setAiProviderState(next)
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

    const prompt = buildAiExplainPrompt({
      articleTitle,
      headings: titlesToExplain,
    })

    const provider = getAiProvider()
    const providerName = AI_PROVIDERS[provider].name
    const copied = await explainWithAi(prompt, provider)
    setFeedback(copied ? `已复制提示词并前往 ${providerName}` : `正在前往 ${providerName}…`)
    window.setTimeout(() => setFeedback(''), 2500)
  }

  const currentProviderName = AI_PROVIDERS[aiProvider]?.name || 'DeepSeek'

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
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border-strong hover:border-primary/70 bg-surface'
                }`}
              >
                {isSelected && <Check className="size-3 stroke-[3]" aria-hidden="true" />}
              </button>

              <a
                href={`#${heading.id}`}
                onClick={(e) => handleHeadingClick(e, heading.id)}
                className={`type-meta block truncate rounded px-1.5 py-1 text-left flex-1 transition-all ${
                  isActive
                    ? 'font-medium text-primary bg-primary/10 translate-x-0.5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:translate-x-0.5'
                }`}
              >
                {heading.text}
              </a>

              {/* 单标题快捷解释图标：悬浮时浮现，一键呼出当前所选 AI 解释 */}
              <button
                type="button"
                aria-label={`${currentProviderName} 解释「${heading.text}」`}
                onClick={() => triggerExplain([heading.text])}
                className="size-6 shrink-0 rounded opacity-0 group-hover/item:opacity-100 focus:opacity-100 hover:bg-muted text-muted-foreground hover:text-primary transition-all flex items-center justify-center cursor-pointer"
              >
                <Sparkles className="size-3" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ol>

      {/* 底部操作面板：有勾选标题时展示，支持切换 AI 与一键解释 */}
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

          {/* AI 引擎选择切换 */}
          <div className="flex items-center justify-between type-caption text-muted-foreground px-1">
            <span>AI 引擎</span>
            <div className="inline-flex rounded-md border border-border-subtle bg-muted/60 p-0.5 text-xs">
              <button
                type="button"
                aria-label="切换至 DeepSeek"
                onClick={() => switchProvider('deepseek')}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                  aiProvider === 'deepseek'
                    ? 'bg-surface text-primary shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                DeepSeek
              </button>
              <button
                type="button"
                aria-label="切换至 Gemini"
                onClick={() => switchProvider('gemini')}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                  aiProvider === 'gemini'
                    ? 'bg-surface text-primary shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Gemini
              </button>
            </div>
          </div>

          <button
            type="button"
            aria-label={`转到 ${currentProviderName} 解释选中小节`}
            onClick={() => triggerExplain()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 type-meta font-medium transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>{currentProviderName} 解释</span>
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
