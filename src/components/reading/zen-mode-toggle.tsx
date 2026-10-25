'use client'

import { useEffect, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { iconButtonClass } from '@/components/primitives/icon-button'

/*
 * Zen 全屏阅读模式：
 * - 一键隐藏站点 chrome（顶栏/页脚/播放条/浮动按钮），把正文铺满视口；
 * - 优先使用 Fullscreen API 收起浏览器自身 UI，退出时同步恢复。
 * - Esc 或按钮均可退出；状态以 fullscreenchange 为准，避免状态漂移。
 */

export function ZenModeToggle() {
  const [zen, setZen] = useState(false)

  useEffect(() => {
    function onFullscreenChange() {
      const isFs = Boolean(document.fullscreenElement)
      setZen(isFs)
      document.documentElement.classList.toggle('zen', isFs)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  async function toggle() {
    try {
      if (!zen) {
        await document.documentElement.requestFullscreen()
      } else if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // Fullscreen 被浏览器拒绝时，仍切换 zen 类，提供降级的沉浸式布局
      const next = !zen
      document.documentElement.classList.toggle('zen', next)
      setZen(next)
    }
  }

  return (
    <button
      type="button"
      aria-label={zen ? '退出 Zen 全屏阅读' : '进入 Zen 全屏阅读'}
      title={zen ? '退出 Zen 全屏阅读' : 'Zen 全屏阅读'}
      onClick={toggle}
      className={iconButtonClass(
        'md',
        'zen-toggle fixed right-4 top-20 z-[60] border border-border-strong bg-surface/85 backdrop-blur-md transition-colors duration-150 hover:border-primary/50 hover:bg-surface hover:text-primary',
      )}
    >
      {zen ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
    </button>
  )
}