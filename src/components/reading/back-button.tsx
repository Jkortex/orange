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
 * - 依据站内来源动态给出返回目标与文案：来自根路径（文章列表）→「← 文章列表」，
 *   来自 /skills →「← 技能列表」，来自分类/标签页 → 对应名称
 * - 直接访问（如外链/书签）时使用确定的语义集合 fallbackHref 兜底，保障 SEO 与容错
 * - 是**确定路由的 Link（前进式导航）**，不是 history.back()：从外链直达时历史里没有上一页，
 *   退回去会退出站点。代价是列表会从顶部开始 —— 浏览器返回键那条路径的滚动恢复由
 *   RouteScrollReset 让位给浏览器（见其注释）
 */
export function BackButton({ fallbackHref, fallbackLabel, className = '' }: BackButtonProps) {
  // 保持初始服务端预渲染状态与静态 HTML 100% 一致，避免水合错误
  const [target, setTarget] = useState({ href: fallbackHref, label: fallbackLabel })

  useEffect(() => {
    try {
      const referrer = document.referrer
      if (referrer) {
        const refUrl = new URL(referrer, window.location.href)
        if (refUrl.hostname === window.location.hostname) {
          const pathname = refUrl.pathname
          if (pathname === '/' || pathname === '') {
            setTarget({ href: '/', label: '文章列表' })
            return
          }
          if (pathname === '/skills' || pathname.startsWith('/skills?')) {
            if (fallbackHref.startsWith('/skills')) {
              setTarget({ href: '/skills', label: '技能列表' })
            }
            return
          }
          if (pathname.startsWith('/category/')) {
            setTarget({ href: pathname, label: '分类' })
            return
          }
          if (pathname.startsWith('/tags/')) {
            setTarget({ href: pathname, label: '标签' })
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
      className={`group type-meta inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-primary ${className}`}
    >
      <span className="inline-block transition-transform duration-150 group-hover:-translate-x-1" aria-hidden="true">
        ←
      </span>
      <span>{target.label}</span>
    </Link>
  )
}
