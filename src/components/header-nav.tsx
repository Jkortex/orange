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
  { href: '/music', label: '音乐' },
  { href: '/skills', label: '技能' },
]

export function HeaderNav({ items = defaultNavItems }: { items?: NavItem[] }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex items-center gap-x-2.5 sm:gap-x-3">
      {items.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`text-sm transition-colors sm:text-base ${
              active
                ? 'font-semibold text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
