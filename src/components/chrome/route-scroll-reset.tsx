'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/*
 * 路由滚动复位组件：
 * 解决在页面长列表/文章底部点击切换下一篇文章时，软导航滚动未完全到顶导致标题被 sticky header 遮盖的问题。
 * 在客户端路由 pathname 变更时，强制瞬时将视口重置到 (0, 0)。
 */
export function RouteScrollReset() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [pathname])

  return null
}
