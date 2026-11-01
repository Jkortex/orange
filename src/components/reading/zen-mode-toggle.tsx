'use client'

import { useEffect, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { iconButtonClass } from '@/components/primitives/icon-button'
import { Tip } from '@/components/primitives/tip'

/*
 * Zen 全屏阅读模式：
 * - 一键隐藏站点 chrome（顶栏/页脚/播放条/浮动按钮），把正文铺满视口；
 * - 优先使用 Fullscreen API 收起浏览器自身 UI，退出时同步恢复。
 * - Esc 或按钮均可退出；状态以 fullscreenchange 为准，避免状态漂移。
 * - 支持 embedded 属性：嵌入 ReadingControls 胶囊时去除外层固定定位。
 */

export function ZenModeToggle({ embedded = false }: { embedded?: boolean } = {}) {
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

  const label = zen ? '退出 Zen 全屏阅读' : '进入 Zen 全屏阅读'

  if (embedded) {
    return (
      <span className="group relative inline-flex">
        <button
          type="button"
          aria-label={label}
          onClick={toggle}
          className={iconButtonClass(
            'md',
            'zen-toggle transition-colors duration-150 hover:text-primary',
          )}
        >
          {zen ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
        </button>
        <Tip className="right-0 top-full mt-1.5">{label}</Tip>
      </span>
    )
  }

  return (
    <span className="group fixed right-4 top-20 z-[60] inline-flex">
      <button
        type="button"
        aria-label={label}
        onClick={toggle}
        className={iconButtonClass(
          'md',
          'zen-toggle border border-border-strong bg-surface/85 backdrop-blur-md transition-colors duration-150 hover:border-primary/50 hover:bg-surface hover:text-primary',
        )}
      >
        {zen ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
      </button>
      <Tip className="right-0 top-full mt-1.5">{label}</Tip>
    </span>
  )
}
