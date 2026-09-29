'use client'

import { useEffect } from 'react'

/**
 * 为正文区域中超出可视宽度的 pre/table/滚动容器自动添加 tabindex="0"，
 * 使键盘用户能够 Tab 聚焦并使用左右方向键横向滚动，提升无障碍访问体验。
 *
 * 除挂载与 resize 外还要盯 DOM 变化：code-demo / mermaid 是展开后才出现滚动区的，
 * 只在挂载时跑一次会永远漏掉它们。
 * 只观察 childList 不观察 attributes —— 回写的正是 tabindex / aria-label，
 * 观察属性会自己触发自己，形成死循环。
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
    const observer = new MutationObserver(makeScrollableFocusable)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', makeScrollableFocusable)
      observer.disconnect()
    }
  }, [])

  return null
}
