'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Menu, Music, Newspaper, NotebookPen, Wrench, type LucideIcon } from 'lucide-react'
import { defaultNavItems, type NavItem } from '@/components/chrome/header-nav'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/*
 * 移动端栏目菜单（经典汉堡 + 侧滑抽屉）：
 * - 顶栏在移动端保持单行：品牌 + 菜单 + 搜索 + 主题；5 个栏目收进抽屉，逐行列出、各占一行。
 * - sm 起由顶栏行内导航接管，抽屉触发器隐藏。
 * - 图标沿用各集合首页的图标（posts=Newspaper / life=NotebookPen / music=Music / skills=Wrench），
 *   菜单里图标只是辅助，栏目名始终是可见文本。
 * - 搜索全站只保留顶栏那一个入口，抽屉里不重复放。
 * - 焦点陷阱、Esc、遮罩点击、滚动锁全部由 Sheet（Radix Dialog）负责，本组件只管内容与关闭时机。
 */

const SECTION_ICONS: Record<string, LucideIcon> = {
  '/': Home,
  '/posts': Newspaper,
  '/life': NotebookPen,
  '/music': Music,
  '/skills': Wrench,
}

export function MobileNavDrawer({ items = defaultNavItems }: { items?: NavItem[] }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
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

      <SheetContent side="left">
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

        <nav aria-label="移动端栏目导航" className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const active = isActive(item.href)
              const Icon = SECTION_ICONS[item.href]
              return (
                <li key={item.href}>
                  {/* SheetClose：跳转前先收起抽屉，否则弹层会留在新页面上 */}
                  <SheetClose asChild>
                    <Link
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
