'use client'

import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  useFloatingStackOffset,
  FLOATING_STACK_ANCHOR,
  FLOATING_STACK_BUTTON,
  FLOATING_STACK_TIP,
} from '@/lib/floating-stack'
import { IconButton, iconButtonClass } from '@/components/primitives/icon-button'
import type { CategoryItem } from '@/lib/categories'

/*
 * 分类过滤复用（posts-explorer / skills-explorer 共用，同属 listing 域）：
 * - countByCategory（@/lib/categories）：由条目聚合分类与条数，与服务端 getCategories 共用同一实现
 * - filterPillClass：桌面端分类行 active/默认态
 * - CategoryFilter：移动端与桌面端两套控件
 *   · 移动端：右下角浮动筛选按钮 + 底部抽屉。
 *     这里换过两版都被否：整条横滑药丸带（读不出「右边还有」、占满屏宽）、
 *     常驻单行下拉（白占一整行、像原生 select、且与下方标题重复「全部」）。
 *     现在完全脱离文档流：折叠时只有一颗 36px 图标按钮（size-9）；选中分类后按钮自身变成
 *     品牌色胶囊并显示分类名，不点开也知道当前筛的是哪个。点开是底部抽屉，
 *     一次摊开全部分类，且是拇指可达区。
 *   · 桌面端（md 起）：吸顶纵向侧栏，计数右对齐成列。
 * - 浮动按钮与 BackToTop / MobileTocDrawer 共用同一条垂直基准轴线（right-4 sm:right-6 md:right-8）：
 *   叠在 BackToTop 出现位（bottom-6 / bottom-20）之上，播放条出现时整体再抬一层。
 *   档位切换带 bottom 过渡（同目录按钮）——刷新且已滚动时档位在水合后才纠正，
 *   有过渡才是平滑上浮而非 44px 瞬移。
 * 「全部」是默认虚拟分类，两端都在第一位。
 */

/** 桌面端分类行样式（拉满侧栏宽度后改为行形状圆角，选中态靠可见边框表达，不填充） */
export function filterPillClass(active: boolean) {
  return [
    'type-meta flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors duration-150 md:w-full md:rounded-lg',
    active
      ? 'border-primary/50 bg-primary/10 font-medium text-primary md:bg-transparent'
      : 'border-transparent text-muted-foreground hover:border-border-subtle hover:bg-muted hover:text-foreground',
  ].join(' ')
}

/** 抽屉里的分类卡：两列网格中的整行可点目标，计数右对齐 */
function sheetItemClass(active: boolean) {
  return [
    'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150',
    active
      ? 'border-primary/50 bg-primary/10 font-medium text-primary'
      : 'border-border-subtle bg-surface text-foreground hover:border-primary/40',
  ].join(' ')
}

export type CategoryFilterProps = {
  categories: CategoryItem[]
  /** null = 全部（不筛选） */
  active: string | null
  onSelect: (name: string | null) => void
  /** 导航无障碍名（文章分类 / 技能分类） */
  navLabel: string
  /** 全部条目数（含无分类的）——「全部」即不筛选，展示所有条目，故计数不能用分类数之和（会漏掉无分类条目） */
  total: number
}

export function CategoryFilter({ categories, active, onSelect, navLabel, total }: CategoryFilterProps) {
  const [open, setOpen] = useState(false)
  const activeLabel = active ?? '全部'
  // 与回到顶部 / 移动端目录共用档位：它出现时本按钮上抬让位，播放条出现时再抬一层
  const bottomClass = useFloatingStackOffset()

  return (
    <>
      {/* 移动端：右下角浮动筛选按钮。与 BackToTop / MobileTocDrawer 是同一套规格：
          size="md"(36px) + size-4 图标 + 同一组描边/底色/hover，右缘同为 right-4 sm:right-6 md:right-8，
          三者叠放时图标才会落在同一条竖轴上。选中态变品牌色胶囊：去掉描边（实心底色本就不需要），
          并把分类名放在图标左侧、右内边距取 pr-2.5 —— 圆形态的图标是按 36px 居中的，
          其右缘距按钮外沿 (36-16)/2 = 10px，无描边时 pr-2.5 恰好等价，两态图标严丝合缝同轴。 */}
      <IconButton
        label={`分类筛选：${activeLabel}`}
        size="md"
        // 选中态是带文字的胶囊：只锁 36px 高度，宽度随内容（见 IconButton width 说明）
        width={active ? 'auto' : undefined}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        wrapperClassName={`${FLOATING_STACK_ANCHOR} md:hidden ${bottomClass}`}
        buttonClassName={
          FLOATING_STACK_BUTTON +
          (active
            ? ' w-auto gap-1.5 border-0 bg-primary pl-3 pr-2.5 font-medium text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
            : '')
        }
        tipClassName={FLOATING_STACK_TIP}
      >
        {active && <span className="max-w-[6rem] truncate text-sm">{active}</span>}
        <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
      </IconButton>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          /* 关掉自带的关闭钮（无内边距、图标 24px），自绘一颗 36px 圆钮，
             与站内其余浮层（栏目抽屉 / 目录抽屉 / 快捷键指南 / 图片预览）统一触摸目标 */
          showCloseButton={false}
          className="max-h-[75vh] gap-0 rounded-t-2xl border-border-subtle pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="border-b border-border-subtle px-5 py-4">
            <SheetTitle className="type-section text-foreground">{navLabel}</SheetTitle>
            <SheetDescription className="sr-only">
              按分类筛选{navLabel}，选择后即时生效
            </SheetDescription>
          </SheetHeader>

          {/* 绝对定位挂在抽屉上（抽屉本身是 fixed，即定位祖先），与标题行垂直居中对齐 */}
          <SheetClose asChild>
            <button
              type="button"
              aria-label="关闭分类筛选"
              className={iconButtonClass('md', 'absolute top-3 right-3 z-10 shrink-0')}
            >
              <X className="size-4" aria-hidden />
            </button>
          </SheetClose>

          <nav aria-label={navLabel} className="overflow-y-auto px-4 py-4">
            <ul className="grid grid-cols-2 gap-2">
              <li>
                <SheetClose asChild>
                  <button
                    type="button"
                    aria-pressed={active === null}
                    onClick={() => onSelect(null)}
                    className={sheetItemClass(active === null)}
                  >
                    <span className="truncate">全部</span>{' '}
                    <span className="type-caption tabular-nums text-muted-foreground">{total}</span>
                  </button>
                </SheetClose>
              </li>
              {categories.map(({ name, count }) => (
                <li key={name}>
                  <SheetClose asChild>
                    <button
                      type="button"
                      aria-pressed={active === name}
                      onClick={() => onSelect(name)}
                      className={sheetItemClass(active === name)}
                    >
                      <span className="truncate">{name}</span>{' '}
                      <span className="type-caption tabular-nums text-muted-foreground">{count}</span>
                    </button>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>

      {/* 桌面端：吸顶纵向侧栏 */}
      <aside className="sticky top-[calc(var(--header-height)+1rem)] z-30 hidden min-w-0 md:block md:max-h-[calc(100vh-var(--header-height)-2rem)] md:overflow-y-auto md:pr-2">
        <nav aria-label={navLabel}>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                aria-pressed={active === null}
                onClick={() => onSelect(null)}
                className={filterPillClass(active === null)}
              >
                全部
              </button>
            </li>
            {categories.map(({ name, count }) => (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={active === name}
                  onClick={() => onSelect(name)}
                  className={filterPillClass(active === name)}
                >
                  {name}{' '}
                  {/* 不写死颜色：随行状态继承（active 时转品牌色），桌面端推到右缘成列 */}
                  <span className="type-caption tabular-nums md:ml-auto">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
