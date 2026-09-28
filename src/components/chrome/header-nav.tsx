'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type NavItem = {
  href: string
  label: string
}

export const defaultNavItems: NavItem[] = [
  { href: '/', label: '首页' },
  { href: '/posts', label: '文章' },
  { href: '/life', label: '生活' },
  { href: '/music', label: '音乐' },
  { href: '/skills', label: '技能' },
]

/*
 * 栏目导航（AGENTS.md 界面布局规范第 1 条）：
 * - 移动端独占顶栏第二行：整宽出血 + 自身横向滚动，文字既不换行也不被压缩；
 *   sm 起恢复与品牌、工具同一行的行内排布。
 * - 项上 shrink-0：一旦允许压缩，flex 会先压胶囊再谈滚动，文字会被挤变形。
 */
export function HeaderNav({ items = defaultNavItems }: { items?: NavItem[] }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav
      aria-label="栏目导航"
      className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 overscroll-x-contain pb-1 scrollbar-none sm:mx-0 sm:gap-x-1 sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {items.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`type-meta shrink-0 rounded-full px-3 py-2 transition-colors duration-150 sm:px-3 sm:py-1.5 sm:text-base ${
              active
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
