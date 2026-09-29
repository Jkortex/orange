'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Menu, Music, Newspaper, NotebookPen, Wrench, X, type LucideIcon } from 'lucide-react'
import { defaultNavItems, type NavItem } from '@/components/chrome/header-nav'
import { iconButtonClass } from '@/components/primitives/icon-button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/*
 * 移动端栏目菜单（经典汉堡 + 侧滑抽屉）：
 * - 顶栏在移动端保持单行：品牌 + 菜单 + 搜索 + 主题；4 个栏目收进抽屉，逐行列出、各占一行。
 * - sm 起由顶栏行内导航接管，抽屉触发器隐藏。
 * - 图标沿用各集合的图标（文章=Newspaper（现为根路径 /）/ life=NotebookPen / music=Music / skills=Wrench），
 *   菜单里图标只是辅助，栏目名始终是可见文本。
 * - 搜索全站只保留顶栏那一个入口，抽屉里不重复放。
 * - 焦点陷阱、Esc、遮罩点击、滚动锁全部由 Sheet（Radix Dialog）负责，本组件只管内容与关闭时机。
 */

const SECTION_ICONS: Record<string, LucideIcon> = {
  '/': Newspaper,
  '/life': NotebookPen,
  '/music': Music,
  '/skills': Wrench,
}

export function MobileNavDrawer({ items = defaultNavItems }: { items?: NavItem[] }) {
  const pathname = usePathname()
  // 抽屉里第一个栏目链接：打开时把焦点放这里（浮层默认会落到 DOM 末尾的关闭按钮）
  const firstItemRef = useRef<HTMLAnchorElement>(null)

  function isActive(href: string) {
    // 根路径即文章列表；文章详情在 /posts/<slug>，也归「文章」高亮
    if (href === '/') return pathname === '/' || pathname.startsWith('/posts/')
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="菜单"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-95 sm:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        /*
         * 关掉 SheetContent 自带的关闭钮（没有内边距、图标 24px），自绘一颗 36px 圆钮，
         * 与站内其余浮层（目录抽屉 / 快捷键指南 / 图片预览）统一触摸目标。
         */
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          // 显式接管自动聚焦：落到第一个栏目，而不是关闭按钮
          event.preventDefault()
          firstItemRef.current?.focus()
        }}
      >
        <SheetHeader className="border-b border-border-subtle px-5 py-4">
          {/* 标题对读屏负责（sr-only），视觉上给品牌标识：抽屉的语义是「栏目导航」 */}
          <SheetTitle className="sr-only">栏目导航</SheetTitle>
          <p className="type-item flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <Home className="size-4 text-primary" aria-hidden />
            </span>
            Orange
          </p>
        </SheetHeader>

        {/* 绝对定位挂在抽屉上（抽屉本身是 fixed，即定位祖先），与品牌行垂直居中对齐 */}
        <SheetClose asChild>
          <button
            type="button"
            aria-label="关闭菜单"
            className={iconButtonClass('md', 'absolute top-3 right-3 z-10 shrink-0')}
          >
            <X className="size-4" aria-hidden />
          </button>
        </SheetClose>

        <nav aria-label="移动端栏目导航" className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1">
            {items.map((item, index) => {
              const active = isActive(item.href)
              const Icon = SECTION_ICONS[item.href]
              return (
                <li key={item.href}>
                  {/* SheetClose：跳转前先收起抽屉，否则弹层会留在新页面上 */}
                  <SheetClose asChild>
                    <Link
                      ref={index === 0 ? firstItemRef : undefined}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`type-item flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-150 ${
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                      {item.label}
                    </Link>
                  </SheetClose>
                </li>
              )
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
