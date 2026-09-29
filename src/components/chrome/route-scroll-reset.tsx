'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/*
 * 路由滚动复位组件：
 * - 前进式导航（点 Link / router.push）：强制瞬时回顶。修的是「从页底点下一篇时
 *   标题被 sticky 顶栏遮住」——软导航自身的滚动不够可靠，这里兜底。
 * - 后退/前进（浏览器返回键触发 popstate）：必须让位。浏览器会恢复离开时的滚动位置，
 *   再强制回顶等于把「从文章返回列表回到原位置」这个原生行为抹掉。
 *
 * 为什么用时间窗而不是布尔标志：popstate 监听器与 Next router 的注册顺序无法保证，
 * 靠顺序读标志会在「router 先更新、effect 先跑」的时序下读到旧值而误判。
 * 时间窗与顺序无关。
 */
const POP_GUARD_MS = 250

export function RouteScrollReset() {
  const pathname = usePathname()
  // -Infinity：保证首次挂载时（Date.now() 很小）不会落进守卫窗口而漏掉初始复位
  const lastPopAtRef = useRef(-Infinity)

  useEffect(() => {
    function onPopState() {
      lastPopAtRef.current = Date.now()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    // 刚发生过后退/前进：滚动位置交还给浏览器恢复
    if (Date.now() - lastPopAtRef.current < POP_GUARD_MS) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}
