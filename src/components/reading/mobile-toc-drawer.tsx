'use client'

import { useState } from 'react'
import { List, Sparkles, X } from 'lucide-react'
import type { TocHeading } from '@/lib/toc'
import { scrollToHeading } from '@/lib/scroll'
import { buildGeminiExplainPrompt, explainWithGemini } from '@/lib/gemini-explain'
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
 * - 档位由 useFloatingStackOffset 统一裁决：BackToTop 出现时平滑上浮腾出位置，
 *   形成视觉协调的双钮操作栈；播放条出现时再抬一层，严防层叠遮挡
 * - 抽屉本体交给 ui/sheet（Radix）：焦点陷阱、Esc、遮罩点击关闭、滚动锁、关闭后焦点还给触发按钮
 *   全部由它接管。此前是手写的 fixed 遮罩 + div[role=dialog]，Esc 与滚动锁都没有，
 *   关掉后焦点也回不到那颗悬浮按钮上。
 * - 支持选中小节并转到 Gemini 解释功能。
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
  const bottomClass = useFloatingStackOffset()

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

    const prompt = buildGeminiExplainPrompt({
      articleTitle,
      headings: titlesToExplain,
    })

    const copied = await explainWithGemini(prompt)
    setFeedback(copied ? '已复制提示词并前往 Gemini' : '正在前往 Gemini…')
    window.setTimeout(() => {
      setFeedback('')
      setIsOpen(false)
    }, 1500)
  }

  return (
    <div className={desktop ? className : `xl:hidden ${className}`}>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {/*
         * 悬浮目录触发按钮：统一的尺寸、对齐线、磨砂质感与提示气泡。
         * 这里不能直接用 IconButton —— SheetTrigger asChild 要求子元素本身是 <button>
         * （Slot 会把 props 直接合并到子元素上，套一层 span 就挂错元素了）。
         * 故外层 span 保留定位与上浮过渡（transition-[bottom,…]），
         * 按钮只负责外观与变色过渡（transition-colors）；两组 transition 落在不同元素上，
         * 合到一个元素会互相顶掉，上浮动画就没了。
         */}
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
          side="bottom"
          showCloseButton={false}
          /* 内容被 Portal 送到 body，外层 div 的 xl:hidden 管不到它：
             抽屉开着时把视口拉宽到 xl，得让抽屉自己也退场 */
          className={
            desktop
              ? 'max-h-[75vh] flex flex-col mx-auto max-w-lg overflow-hidden rounded-t-2xl border-t border-border-subtle p-5'
              : 'xl:hidden max-h-[75vh] flex flex-col mx-auto max-w-lg overflow-hidden rounded-t-2xl border-t border-border-subtle p-5'
          }
        >
          {/* 顶栏 */}
          <div className="mb-4 flex shrink-0 items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-primary" aria-hidden="true" />
              <SheetTitle className="type-section text-foreground">文章目录</SheetTitle>
              <span className="type-caption font-mono text-muted-foreground">
                ({headings.length} 节)
              </span>
            </div>
            <SheetClose asChild>
              <button
                type="button"
                aria-label="关闭目录"
                className={iconButtonClass('md', 'shrink-0')}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </SheetClose>
          </div>

          {/* 目录列表 */}
          <nav className="overflow-y-auto pr-1 py-1 space-y-1 flex-1 min-h-0">
            {headings.map((heading) => {
              const isSelected = selectedIds.has(heading.id)

              return (
                <div
                  key={heading.id}
                  className={`group/item flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-muted ${
                    heading.depth === 3 ? 'pl-6' : ''
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
                    aria-label={`Gemini 解释「${heading.text}」`}
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

              <button
                type="button"
                aria-label="转到 Gemini 解释选中小节"
                onClick={() => triggerExplain()}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 type-meta font-medium transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>Gemini 解释 ({selectedIds.size})</span>
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
