'use client'

import * as React from 'react'
import { centerSvgViewBox } from '@/lib/mermaid-viewbox'

/*
 * mermaid 画布的两种用法（正文卡片内、放大浮层内）共用这一个组件：
 * 都是「把一段 SVG 字符串塞进 DOM」，区别只在外面套的类名。
 *
 * 为什么要包成组件而不是各处写 dangerouslySetInnerHTML：SVG 一进浏览器就得量一次真实
 * bbox、把偏心的 viewBox 收紧回中心（见 lib/mermaid-viewbox.ts），这段逻辑必须跟着画布走，
 * 抄两遍必然漏一处。
 *
 * 用回调 ref 而不是 useRef + useEffect：Radix 的 Presence 会把浮层内容延后一次提交挂载，
 * 依赖数组为空的 useEffect 里 ref 可能还是 null；回调 ref 在节点真正插入 DOM 后同步触发，
 * 且 getBBox() 本身就会强制布局，量到的就是当前真实几何。
 *
 * 根元素是 <span>（display 交给调用方的类名）：正文那处整个画布嵌在触发按钮 <button> 里，
 * 而 button 的内容模型只允许短语内容，放 <div> 是非法嵌套。
 */
/*
 * 关于 Chromium 下内联 SVG text-anchor 文字偏移修复：
 * Dialog 打开时伴随 CSS 缩放入场动画（zoom-in-95，200ms），且 SVG 依赖 WebFont 异步加载；
 * 首帧在动画未完成或字体未决时排版，Chromium 会冻结错误的文字偏移快照，直到用户点击触发重排才恢复。
 * 因此除了首帧同步校准以满足单测与 SSR 连贯性外，还在字体就绪、动画结束（animationend）与
 * 250ms 定时器触发后再次校准，并通过瞬时切换 display 强制重建 Chromium 内部 SVG 排版树。
 */
export interface MermaidCanvasProps {
  /** beautiful-mermaid 生成的 SVG 字符串，根标签就是 <svg> */
  svg: string
  /** 布局类名由调用方决定：正文要 .mermaid-canvas + 内边距，浮层要铺满画布 */
  className?: string
}

export function MermaidCanvas({ svg, className }: MermaidCanvasProps) {
  const measure = React.useCallback((host: HTMLSpanElement | null) => {
    if (!host) return
    const root = host.firstElementChild
    if (!(root instanceof SVGSVGElement)) return

    // 1. 首帧同步校准（保证初次挂载与单测环境同步拿到准确的 viewBox）
    centerSvgViewBox(root)

    // 2. 刷新函数：重新量取真实 bbox 校准 viewBox，并强制刷新 Chromium 内部的 SVG text-anchor 布局树
    const refresh = () => {
      if (!root.isConnected) return
      centerSvgViewBox(root)
      // 瞬时切换 display 并触发回流，强制 Chromium 重建并校准 SVG 文本排版节点（单帧内完成无闪烁）
      root.style.display = 'none'
      void root.getBoundingClientRect()
      root.style.display = ''
    }

    // 3. 字体就绪监听：当异步字体加载完成时刷新
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(refresh)
        } else {
          refresh()
        }
      })
    }

    // 4. 浮层动画监听：Dialog 打开时通常有 200ms 入场缩放动画，动画完成后立即校准
    const dialog = host.closest('[data-slot="dialog-content"]')
    if (dialog) {
      dialog.addEventListener('animationend', refresh, { once: true })
    }

    // 5. 兜底定时器：兼顾无动画事件或系统级动效减弱等场景
    const timer = setTimeout(refresh, 250)

    return () => {
      clearTimeout(timer)
      if (dialog) {
        dialog.removeEventListener('animationend', refresh)
      }
    }
  }, [])

  return <span ref={measure} className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}
