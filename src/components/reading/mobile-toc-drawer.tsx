'use client'

import { useState } from 'react'
import { List, X } from 'lucide-react'
import type { TocHeading } from '@/lib/toc'
import { scrollToHeading } from '@/lib/scroll'
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
 */

export function MobileTocDrawer({
  headings,
  className = '',
}: {
  headings: TocHeading[]
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const bottomClass = useFloatingStackOffset()

  if (headings.length === 0) return null

  function handleHeadingClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault()
    scrollToHeading(id)
    setIsOpen(false)
  }

  return (
    <div className={`xl:hidden ${className}`}>
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
          className="xl:hidden max-h-[75vh] mx-auto max-w-lg overflow-hidden rounded-t-2xl border-t border-border-subtle p-5"
        >
          {/* 顶栏 */}
          <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
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
          <nav className="overflow-y-auto pr-1 py-1 space-y-1">
            {headings.map((heading) => (
              <SheetClose asChild key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => handleHeadingClick(e, heading.id)}
                  className={`type-meta block rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:bg-primary/10 ${
                    heading.depth === 3 ? 'pl-7 type-caption' : 'font-medium'
                  }`}
                >
                  {heading.text}
                </a>
              </SheetClose>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
