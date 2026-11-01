'use client'

import { useEffect, useState } from 'react'
import { List, Sparkles, X } from 'lucide-react'
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
import {
  useFloatingStackOffset,
  FLOATING_STACK_ANCHOR,
  FLOATING_STACK_BUTTON,
  FLOATING_STACK_TIP,
} from '@/lib/floating-stack'
import { iconButtonClass } from '@/components/primitives/icon-button'
import { Tip } from '@/components/primitives/tip'
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/*
 * 移动端/窄屏目录抽屉与悬浮入口（< xl）：
 * - 与 BackToTop 共享同一垂直基准轴线（right-4 sm:right-6 md:right-8）与同一档位（IconButton 的 size-9）
 * - 档位由 useFloatingStackOffset 统一裁决
 * - 支持选中小节并转到 AI（DeepSeek / Gemini）解释功能
 */

export function MobileTocDrawer({
  headings,
  articleTitle,
  className = '',
  desktop = false,
}: {
  headings: TocHeading[]
  articleTitle?: string
  className?: string
  /** 分栏文章在桌面端也没有侧栏目录，需把浮动目录扩展到所有断点 */
  desktop?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<string>('')
  const [aiProvider, setAiProviderState] = useState<AiProvider>('deepseek')
  const bottomClass = useFloatingStackOffset()

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

  if (headings.length === 0) return null

  function handleHeadingClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault()
    scrollToHeading(id)
    setIsOpen(false)
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
      titlesToExplain = headings
        .filter((h) => selectedIds.has(h.id))
        .map((h) => h.text)
    }

    if (titlesToExplain.length === 0) {
      titlesToExplain = [headings[0].text]
    }

    const prompt = buildAiExplainPrompt({
      articleTitle,
      headings: titlesToExplain,
    })

    const provider = getAiProvider()
    const providerName = AI_PROVIDERS[provider].name
    const copied = await explainWithAi(prompt, provider)
    setFeedback(copied ? `已复制提示词并前往 ${providerName}` : `正在前往 ${providerName}…`)
    window.setTimeout(() => {
      setFeedback('')
      setIsOpen(false)
    }, 1500)
  }

  const currentProviderName = AI_PROVIDERS[aiProvider]?.name || 'DeepSeek'

  return (
    <div className={desktop ? className : `xl:hidden ${className}`}>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <span
          className={`${FLOATING_STACK_ANCHOR} ${bottomClass} inline-flex animate-in fade-in-0 zoom-in-90`}
        >
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="文章目录"
              className={iconButtonClass('md', `shrink-0 ${FLOATING_STACK_BUTTON}`)}
            >
              <List className="size-4" aria-hidden="true" />
              <Tip className={FLOATING_STACK_TIP}>文章目录</Tip>
            </button>
          </SheetTrigger>
        </span>

        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[22rem] max-w-[85vw] flex flex-col p-5 gap-0"
        >
          {/* 抽屉头部 */}
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle shrink-0">
            <SheetTitle className="type-section text-foreground">文章目录</SheetTitle>

            <SheetClose asChild>
              <button
                type="button"
                aria-label="关闭目录"
                className={iconButtonClass('md', 'absolute top-3 right-3 z-10 shrink-0 text-muted-foreground hover:text-foreground')}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </SheetClose>
          </div>

          {/* 目录列表 */}
          <nav aria-label="文章目录列表" className="flex-1 overflow-y-auto py-4 space-y-1">
            {headings.map((heading) => {
              const isSelected = selectedIds.has(heading.id)

              return (
                <div
                  key={heading.id}
                  className={`flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-muted/50 transition-colors ${
                    heading.depth === 3 ? 'ml-4' : ''
                  }`}
                >
                  {/* 复选框：原生 input checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    aria-label={`选择章节：${heading.text}`}
                    onChange={() => toggleSelect(heading.id)}
                    className="size-4 shrink-0 rounded border-border-subtle text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                  />

                  <a
                    href={`#${heading.id}`}
                    onClick={(e) => handleHeadingClick(e, heading.id)}
                    className={`type-meta block flex-1 truncate text-muted-foreground transition-colors hover:text-foreground active:text-primary ${
                      heading.depth === 3 ? 'type-caption' : 'font-medium'
                    }`}
                  >
                    {heading.text}
                  </a>

                  {/* 单节快捷解释入口 */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`${currentProviderName} 解释「${heading.text}」`}
                    onClick={() => triggerExplain([heading.text])}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        triggerExplain([heading.text])
                      }
                    }}
                    className="size-7 shrink-0 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Sparkles className="size-3.5" aria-hidden="true" />
                  </span>
                </div>
              )
            })}
          </nav>

          {/* 底部操作条 */}
          {selectedIds.size > 0 && (
            <div className="shrink-0 pt-3 mt-3 border-t border-border-subtle space-y-2 animate-in fade-in-50 duration-200">
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
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 type-meta font-medium transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>{currentProviderName} 解释 ({selectedIds.size})</span>
              </button>

              {feedback && (
                <p className="type-caption text-center text-primary animate-in fade-in duration-150">
                  {feedback}
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
