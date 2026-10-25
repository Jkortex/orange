'use client'

import { useState } from 'react'
import { List, X } from 'lucide-react'
import Link from 'next/link'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { iconButtonClass } from '@/components/primitives/icon-button'

/*
 * 专栏目录浮动入口：
 * - 专栏详情页章节很多，整页滚动查找阶段/章节成本高；这里用一颗贴边浮动按钮
 *   唤起右侧抽屉，列出全部阶段与章节，点选即跳转，不占用正文阅读空间。
 * - 抽屉与站内其余浮层统一：Radix Sheet 负责焦点陷阱 / Esc / 遮罩关闭 / 滚动锁。
 */

export type ColumnTocPhase = {
  name: string
  chapters: { slug: string; title: string }[]
}

export function ColumnToc({ phases }: { phases: ColumnTocPhase[] }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="打开专栏目录"
          className="fixed right-4 bottom-20 z-40 flex size-9 items-center justify-center rounded-full border border-border-strong bg-surface/85 text-muted-foreground backdrop-blur-md transition-colors duration-150 hover:border-primary/50 hover:bg-surface hover:text-primary active:scale-95"
        >
          <List className="size-4" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent side="right" showCloseButton={false} className="w-[22rem] max-w-[85vw] gap-0">
        <SheetHeader className="border-b border-border-subtle px-5 py-4">
          <SheetTitle className="type-section text-foreground">专栏目录</SheetTitle>
        </SheetHeader>

        <SheetClose asChild>
          <button
            type="button"
            aria-label="关闭专栏目录"
            className={iconButtonClass('md', 'absolute top-3 right-3 z-10 shrink-0')}
          >
            <X className="size-4" aria-hidden />
          </button>
        </SheetClose>

        <nav aria-label="专栏目录" className="flex-1 overflow-y-auto px-4 py-4">
          <ol className="space-y-4">
            {phases.map((phase, index) => (
              <li key={phase.name} className="space-y-2">
                <SheetClose asChild>
                  <a
                    href={`#phase-${index}`}
                    className="type-item flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    {phase.name}
                  </a>
                </SheetClose>
                <ul className="ml-7 space-y-1 border-l border-border-subtle pl-3">
                  {phase.chapters.map((chapter) => (
                    <li key={chapter.slug}>
                      <SheetClose asChild>
                        <Link
                          href={`/posts/${chapter.slug}`}
                          className="type-meta block truncate text-muted-foreground transition-colors hover:text-primary"
                        >
                          {chapter.title}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </nav>
      </SheetContent>
    </Sheet>
  )
}