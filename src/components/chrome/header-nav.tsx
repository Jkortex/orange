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

export function HeaderNav({ items = defaultNavItems }: { items?: NavItem[] }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex items-center gap-x-0.5 sm:gap-x-1">
      {items.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-2.5 py-1.5 text-[15px] transition-colors duration-150 sm:px-3 sm:text-base ${
              active
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
