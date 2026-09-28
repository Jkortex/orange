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
 * 顶栏行内文字导航（sm 及以上；移动端由 MobileNavDrawer 承担，见 AGENTS.md 界面布局规范第 1 条）：
 * - 栏目名始终是可见文本，不缩写、不图标化；项上 shrink-0，避免 flex 压缩把文字挤变形
 * - py-2 让触摸目标不小于 36px（平板竖屏 640~768px 也在用这一套）
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
    <nav aria-label="栏目导航" className="flex items-center gap-x-1">
      {items.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`type-meta shrink-0 rounded-full px-3 py-2 transition-colors duration-150 ${
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
