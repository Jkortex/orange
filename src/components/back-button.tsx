'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export type BackButtonProps = {
  /** 兜底默认路径（无历史记录或站外来源时使用） */
  fallbackHref: string
  /** 兜底默认文案 */
  fallbackLabel: string
  className?: string
}

/*
 * 动态返回导航：
 * - 从首页进入文章/技能时，动态呈现「← 首页」，点击返回首页并保留状态与滚动位
 * - 从列表页进入时呈现「← 文章列表 / ← 技能列表」
 * - 直接访问（如外链/书签）时使用确定的语义集合 fallbackHref 兜底，保障 SEO 与容错
 * - 原生 window.history.back() 保留精确滚动位置，无 AppRouter 上下文依赖
 */
export function BackButton({ fallbackHref, fallbackLabel, className = '' }: BackButtonProps) {
  // 保持初始服务端预渲染状态与静态 HTML 100% 一致，避免水合错误
  const [target, setTarget] = useState({
    href: fallbackHref,
    label: fallbackLabel,
    canGoBack: false,
  })

  useEffect(() => {
    try {
      const referrer = document.referrer
      if (referrer) {
        const refUrl = new URL(referrer, window.location.href)
        if (refUrl.hostname === window.location.hostname) {
          const pathname = refUrl.pathname
          if (pathname === '/' || pathname === '') {
            setTarget({ href: '/', label: '首页', canGoBack: true })
            return
          }
          if (pathname === '/posts' || pathname.startsWith('/posts?')) {
            setTarget({ href: '/posts', label: '文章列表', canGoBack: true })
            return
          }
          if (pathname === '/skills' || pathname.startsWith('/skills?')) {
            setTarget({ href: '/skills', label: '技能列表', canGoBack: true })
            return
          }
          if (pathname.startsWith('/category/')) {
            setTarget({ href: pathname, label: '分类', canGoBack: true })
            return
          }
          if (pathname.startsWith('/tags/')) {
            setTarget({ href: pathname, label: '标签', canGoBack: true })
            return
          }
        }
      }
    } catch {
      // 异常保持兜底配置
    }
  }, [fallbackHref, fallbackLabel])

  return (
    <Link
      href={target.href}
      className={`group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary ${className}`}
    >
      <span className="inline-block transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true">
        ←
      </span>
      <span>{target.label}</span>
    </Link>
  )
}
