'use client'

import { useEffect } from 'react'

/**
 * 为正文区域中超出可视宽度的 pre/table 元素自动添加 tabindex="0"，
 * 使键盘用户能够 Tab 聚焦并使用左右方向键横向滚动，提升无障碍访问体验。
 */
export function A11yScrollable() {
  useEffect(() => {
    function makeScrollableFocusable() {
      const scrollables = document.querySelectorAll<HTMLElement>(
        '.prose pre, .prose table, .prose .overflow-x-auto',
      )
      for (const el of scrollables) {
        if (el.scrollWidth > el.clientWidth && !el.hasAttribute('tabindex')) {
          el.tabIndex = 0
          if (!el.getAttribute('aria-label')) {
            el.setAttribute('aria-label', '可横向滚动区域')
          }
        }
      }
    }

    makeScrollableFocusable()
    window.addEventListener('resize', makeScrollableFocusable)
    return () => window.removeEventListener('resize', makeScrollableFocusable)
  }, [])

  return null
}
