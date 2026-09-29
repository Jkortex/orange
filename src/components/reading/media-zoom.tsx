'use client'

import * as React from 'react'
import { Minus, Plus, RotateCcw, X, ZoomIn } from 'lucide-react'
import {
  TransformComponent,
  TransformWrapper,
  useControls,
  useTransformComponent,
} from 'react-zoom-pan-pinch'
import { cn } from '@/lib/utils'
import { IconButton, iconButtonClass } from '@/components/primitives/icon-button'
import { MermaidCanvas } from '@/components/reading/mermaid-canvas'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'

/*
 * 正文媒体的统一「放大查看」：触发按钮 + 单张放大浮层，一个组件包办。
 *
 * 手势层用 react-zoom-pan-pinch，不自己写：Radix 与 shadcn 官方都没有 zoom/pinch/pan 原语
 * （Radix 只有 Dialog / Scroll Area / Slider），而捏合缩放、惯性平移、双击、指针事件数学
 * 与 Portal / 焦点陷阱是同一类「不该手写」的东西。库负责手势，Radix 仍然负责浮层外壳。
 *
 * 为什么与 listing/ImageLightbox 并存而不是复用它：灯箱是**照片轮播**（多图 + 上下张 + 圆点），
 * 而这里的正文图与 mermaid 图表都是单张，且 mermaid 的「媒体」是一段内联 SVG 字符串、
 * 不是 URL —— 灯箱只吃 string[]，react-medium-image-zoom 只吃 <img src>，都塞不进来。
 * 好在本库的 TransformComponent 收的是 children，内联 SVG 照样能用。
 *
 * 为什么触发按钮也放在这里：两个调用方（markdown 的 img 映射、mermaid 画布）需要同一套
 * aria-haspopup / 光标 / 悬停角标 / 触发按钮 ref，各抄一遍必然走样。
 */

export type MediaZoomSource =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'svg'; svg: string; alt: string }

export interface MediaZoomProps {
  source: MediaZoomSource
  /** 触发按钮的无障碍名（aria-label 会覆盖按钮由内容推导出的名字，内层 alt 不会被读两遍） */
  label: string
  /** 悬停/聚焦时显示的角标文案；不传则不渲染角标 */
  hint?: string
  /** 触发按钮的布局（display / 宽度 / 外边距）由调用方决定；视觉装饰已在组件内统一重置 */
  className?: string
  children: React.ReactNode
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
/** 库的 zoomIn/zoomOut 收的是**绝对增量**（注释原文：zoomIn(0.25) from 1 lands on 1.25），正好等于我们原来的一档 25% */
const ZOOM_STEP = 0.25
/** 双击/双指双击的目标倍率：增量 1 → 100% 与 200% 之间来回切 */
const DOUBLE_TAP_STEP = 1
/** 键盘方向键每按一次平移的像素 */
const KEY_PAN_STEP = 50
/*
 * 按钮缩放不走补间动画（传 0 让库直接落值）。
 * 库默认 300ms，且每帧从**当前插值**的 scale 起算 —— 连点会互相取消、越点越慢，
 * 不如干脆瞬时，行为与手感都确定。捏合与双击各自仍有动画，动效不至于全丢。
 */
const BUTTON_ZOOM_ANIMATION_MS = 0
/*
 * 滚轮步长。库默认 0.015，而它按 `step × |deltaY|` 算：鼠标滚轮一格 deltaY≈100
 * → 一格就跳 1.5 倍（100% 直接到 250%），明显是照触控板的小 delta 调的。
 * 0.002 让鼠标一格 ≈ +20%，触控板捏合则靠一长串小事件累积到相近量级。
 */
const WHEEL_ZOOM_STEP = 0.002

/*
 * 顶栏。必须是 TransformWrapper 的**子组件**：它靠 useControls / useTransformComponent
 * 从 context 拿命令与实时倍率，而 context 只能从内部取。
 *
 * 倍率用 useTransformComponent 订阅而不是把 onTransform 提到 MediaZoom 里 setState：
 * 后者每一帧都会重渲染整个浮层（含内联 SVG 的 dangerouslySetInnerHTML 节点），
 * 前者只重渲染这一小块顶栏。
 */
function ZoomBar({ alt }: { alt: string }) {
  const { zoomIn, zoomOut, resetTransform } = useControls()
  const percent = useTransformComponent(({ state }) => Math.round(state.scale * 100))

  return (
    <div className="panel-bar flex items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-2">
      <span className="type-caption truncate font-medium text-muted-foreground">{alt}</span>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* 提示气泡要放在按钮下方：顶栏贴着浮层上沿，默认的「上方」会被 overflow-hidden 裁掉 */}
        <IconButton
          label="缩小"
          onClick={() => zoomOut(ZOOM_STEP, BUTTON_ZOOM_ANIMATION_MS)}
          disabled={percent <= MIN_ZOOM * 100}
          tipClassName="top-full right-0 mt-1.5"
        >
          <Minus className="size-4" aria-hidden />
        </IconButton>

        <span
          role="status"
          className="type-caption w-12 text-center tabular-nums text-muted-foreground"
        >
          {percent}%
        </span>

        <IconButton
          label="放大"
          onClick={() => zoomIn(ZOOM_STEP, BUTTON_ZOOM_ANIMATION_MS)}
          disabled={percent >= MAX_ZOOM * 100}
          tipClassName="top-full right-0 mt-1.5"
        >
          <Plus className="size-4" aria-hidden />
        </IconButton>

        <IconButton
          label="复位"
          onClick={() => resetTransform(BUTTON_ZOOM_ANIMATION_MS)}
          disabled={percent === 100}
          tipClassName="top-full right-0 mt-1.5"
        >
          <RotateCcw className="size-4" aria-hidden />
        </IconButton>

        <DialogClose asChild>
          <button type="button" aria-label="关闭放大查看" className={iconButtonClass('md', 'ml-1')}>
            <X className="size-4" aria-hidden />
          </button>
        </DialogClose>
      </div>
    </div>
  )
}

export function MediaZoom({ source, label, hint, className, children }: MediaZoomProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          /*
           * 基础样式全写在这里，不给调用方漏掉的机会：
           * - 触发按钮包着整块媒体，焦点环漏一处键盘用户就看不见焦点
           * - 按钮必须完全隐形（`border-0 bg-transparent p-0`），视觉全由被包的媒体承担，
           *   否则会在图片圆角外或 mermaid 卡片里多出一圈按钮底色
           * - 光标用 zoom-in，是「点开看大图」的既有隐喻
           */
          'group/zoom relative cursor-zoom-in border-0 bg-transparent p-0',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        {children}
        {hint && (
          <span className="type-caption pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 font-medium text-foreground opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover/zoom:opacity-100 group-focus-visible/zoom:opacity-100">
            <ZoomIn className="size-3.5 text-primary" aria-hidden />
            {hint}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          /*
           * 自绘顶栏 + 缩放画布，故覆盖掉基类的 grid/gap-4/p-6。
           *
           * 高度必须是**确定值**（h- 而非 max-h-）：画布要按百分比撑满剩余空间，
           * 而百分比只在父级高度确定时才有意义；内容撑高的话，缩放时浮层会跟着一起长高乱跳。
           * 不写 max-w-5xl 而写 sm:max-w-5xl：基类的 max-w-[calc(100%-2rem)] 负责移动端两侧留白。
           * 用 dvh 而不是 vh：移动端地址栏收起/展开时 vh 不变，90vh 会把底边顶出可视区。
           */
          className="flex h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
          onCloseAutoFocus={(event) => {
            // Radix 对 modal 浮层只把焦点还给 DialogTrigger；本浮层没有触发器，自己还给触发按钮
            event.preventDefault()
            triggerRef.current?.focus()
          }}
        >
          <DialogTitle className="sr-only">{source.alt}（放大查看）</DialogTitle>

          <TransformWrapper
            minScale={MIN_ZOOM}
            maxScale={MAX_ZOOM}
            initialScale={1}
            limitToBounds
            /*
             * 不传 wheel.activationKeys（默认任意滚轮都缩放）：画布本身没有可滚动内容，
             * 不存在「劫持滚动」的问题；而若要求按住 Ctrl/⌘，触控板捏合反而会失效 ——
             * 浏览器合成的是 wheel+ctrlKey，并不会真的派发 Control 的 keydown，
             * 而库的 isPressingKeys 查的是真实按键状态。
             */
            wheel={{ step: WHEEL_ZOOM_STEP }}
            /* 双击在 100% / 200% 之间来回切 */
            doubleClick={{ mode: 'toggle', step: DOUBLE_TAP_STEP }}
            /* keyboard.disabled 默认 true（库刻意让键盘导航 opt-in），必须显式打开；嵌套对象只做浅合并，不会自动继承 */
            keyboard={{ disabled: false, panStep: KEY_PAN_STEP, zoomStep: ZOOM_STEP }}
          >
            <ZoomBar alt={source.alt} />

            <TransformComponent
              /*
               * 库自带的样式表是**未分层**注入的（styleInject 进 <head>），
               * 而未分层的作者样式无条件赢过 Tailwind 所在的 @layer utilities，
               * 所以 width 只能靠 wrapperStyle 内联覆盖掉它的 width: fit-content；
               * 高度走 flex-1 + min-h-0，让它在定高的浮层里吃掉剩余空间并可收缩。
               *
               * touch-none 是必须的：库只挂了 touchstart/move/end，自己不设 touch-action，
               * 不补的话双指捏合会**同时**触发浏览器整页缩放，变成双重放大。
               */
              wrapperClass="min-h-0 flex-1 touch-none"
              wrapperStyle={{ width: '100%' }}
              wrapperProps={{
                'aria-label': '可缩放查看区域，可用方向键平移、加减号缩放',
              }}
              /*
               * 媒体盒铺满画布，缩放倍率才是「相对铺满后的尺寸」——
               * 否则倍率会相对图片原始像素，minScale/maxScale 的 50%/400% 就失去意义。
               * 库的 content 默认是 fit-content，用 contentStyle 内联改成 100%。
               */
              contentClass="items-center justify-center"
              contentStyle={{ width: '100%', height: '100%' }}
            >
              {source.kind === 'image' ? (
                /*
                 * max-h-full / max-w-full 而不是 w-full：max-* 只压不放，
                 * 小图保持原始尺寸不被拉大；两个方向同时约束时浏览器按内禀宽高比取更紧的一边
                 * （替换元素的约束冲突规则），等效 object-contain。
                 */
                <img
                  src={source.src}
                  alt={source.alt}
                  className="block max-h-full max-w-full"
                />
              ) : (
                /*
                 * 内联 SVG 不走 .mermaid-canvas：那条规则是给正文用的（未分层 + 只压宽度），
                 * 这里要的是**确定盒子 + preserveAspectRatio 等比留白**。
                 * 生成的 SVG 根标签没写 preserveAspectRatio，默认 xMidYMid meet，正好是 contain。
                 *
                 * 仍走 MermaidCanvas：浮层把 SVG 拉满画布，上游 viewBox 偏心那 1.5% 会同样被放大，
                 * 是「图整体右偏」最刺眼的场景 —— 挂载时量 bbox 收紧 viewBox 正是为了这里。
                 */
                <MermaidCanvas
                  svg={source.svg}
                  className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
                />
              )}
            </TransformComponent>
          </TransformWrapper>
        </DialogContent>
      </Dialog>
    </>
  )
}
