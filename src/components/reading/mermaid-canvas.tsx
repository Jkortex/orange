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
export interface MermaidCanvasProps {
  /** beautiful-mermaid 生成的 SVG 字符串，根标签就是 <svg> */
  svg: string
  /** 布局类名由调用方决定：正文要 .mermaid-canvas + 内边距，浮层要铺满画布 */
  className?: string
}

export function MermaidCanvas({ svg, className }: MermaidCanvasProps) {
  const measure = React.useCallback((host: HTMLSpanElement | null) => {
    const root = host?.firstElementChild
    if (root instanceof SVGSVGElement) centerSvgViewBox(root)
  }, [])

  return <span ref={measure} className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}
