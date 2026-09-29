// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { CategoryFilter, filterPillClass } from '@/components/listing/category-filter'
import { stubBrowserApis, unstubBrowserApis } from '@/components/test-utils/stub-browser-apis'

beforeEach(() => {
  // Radix Sheet 需要 ResizeObserver
  stubBrowserApis()
})

afterEach(() => {
  cleanup()
  unstubBrowserApis()
})

describe('filterPillClass', () => {
  it('active 与默认态可区分', () => {
    expect(filterPillClass(true)).toContain('text-primary')
    expect(filterPillClass(false)).toContain('text-muted-foreground')
  })

  it('桌面端拉满侧栏宽度（计数才能右对齐成列）', () => {
    expect(filterPillClass(true)).toContain('md:w-full')
    expect(filterPillClass(false)).toContain('md:w-full')
  })

  it('桌面端改用行形状圆角（全宽胶囊会读成一颗大按钮）', () => {
    expect(filterPillClass(false)).toContain('md:rounded-lg')
  })

  it('桌面端选中态用可见边框表达（全宽行 + 行圆角）', () => {
    const on = filterPillClass(true)
    expect(on, '选中行须有可见边框').toContain('border-primary/50')
    expect(on, '桌面端不填充底色，靠边框区分').toContain('md:bg-transparent')
  })

  it('默认态边框透明：桌面端两侧仅靠边框有无区分', () => {
    expect(filterPillClass(false)).toContain('border-transparent')
  })

  it('已废弃左侧竖条方案（不留死代码）', () => {
    const on = filterPillClass(true)
    expect(on).not.toContain('before:bg-primary')
    expect(on).not.toContain('before:content')
  })
})

describe('CategoryFilter 正常渲染', () => {
  function Harness() {
    const [active, setActive] = useState<string | null>(null)
    return (
      <CategoryFilter
        categories={[
          { name: 'css', count: 2 },
          { name: 'meta', count: 1 },
        ]}
        active={active}
        onSelect={setActive}
        navLabel="文章分类"
        total={3}
      />
    )
  }

  it('渲染「全部」与分类（含条数），默认激活「全部」', () => {
    render(<Harness />)
    expect(screen.getByRole('navigation', { name: '文章分类' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '全部' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'css 2' })).toBeTruthy()
  })

  it('点击分类回调用选中名', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'meta 1' }))
    expect(screen.getByRole('button', { name: 'meta 1' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '全部' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('计数跟随选中态颜色（不写死），且桌面端右对齐', () => {
    render(<Harness />)
    const count = screen.getByRole('button', { name: 'css 2' }).querySelector('span')
    expect(count?.className, '计数写死颜色会导致 active 时仍是灰的').not.toContain('text-muted-foreground')
    expect(count?.className, '桌面端计数须右对齐').toContain('md:ml-auto')
  })
})

/*
 * 移动端分类控件：右下角浮动筛选按钮 + 底部抽屉。
 * 前两版（整条横滑药丸带 / 常驻单行下拉）都被否——前者读不出「右边还有」且占满屏宽，
 * 后者白占一整行、像原生 select、还与下方标题重复「全部」。现在脱离文档流。
 */
describe('CategoryFilter 移动端浮动筛选', () => {
  const CATS = [
    { name: 'css', count: 2 },
    { name: 'meta', count: 1 },
  ]

  function renderFilter(
    active: string | null = null,
    onSelect: (n: string | null) => void = () => {},
    total = 3,
  ) {
    return render(
      <CategoryFilter
        categories={CATS}
        active={active}
        onSelect={onSelect}
        navLabel="文章分类"
        total={total}
      />,
    )
  }

  it('收起时是脱离文档流的浮动按钮，不占一整行', () => {
    const { container } = renderFilter()

    const trigger = screen.getByRole('button', { name: '分类筛选：全部' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    // fixed 定位 = 不参与文档流，列表不会被顶下去
    const floating = trigger.closest('span')?.className ?? ''
    expect(floating).toContain('fixed')
    // 不再有整宽的吸顶分类条
    expect(container.innerHTML).not.toContain('top-[var(--header-height)]')
  })

  it('idle 只显示图标；选中后按钮自身显示分类名（状态不用点开也能读）', () => {
    const { unmount } = renderFilter()
    expect(screen.getByRole('button', { name: '分类筛选：全部' }).querySelector('.truncate')).toBeNull()
    unmount()

    renderFilter('css')
    const trigger = screen.getByRole('button', { name: '分类筛选：css' })
    expect(trigger.querySelector('.truncate')?.textContent).toBe('css')
    expect(trigger.className, '选中态用品牌色胶囊表达').toContain('bg-primary')
  })

  /*
   * 与 BackToTop / MobileTocDrawer 是叠放的一对，视觉规格必须逐项一致，
   * 否则图标中心会错开、两个圆看起来不是一套。BackToTop 的实际取值：
   *   size="md"(size-9=36px) + size-4 图标 + border-border-strong bg-surface/85
   * 这里把同一组值钉死，改动时不会单方面漂移。
   */
  it('规格与 BackToTop 完全一致（尺寸/图标/描边/底色）', () => {
    renderFilter()
    const btn = screen.getByRole('button', { name: '分类筛选：全部' })

    expect(btn.getAttribute('data-size'), '盒子尺寸须与 BackToTop 同为 md(36px)').toBe('md')
    expect(btn.className).toContain('border-border-strong')
    expect(btn.className).toContain('bg-surface/85')
    expect(btn.className).toContain('backdrop-blur-md')
    expect(btn.querySelector('svg')?.getAttribute('class')).toContain('size-4')
  })

  it('右缘基准与 BackToTop 相同（叠放时右缘齐平）', () => {
    renderFilter()
    const floating = screen.getByRole('button', { name: '分类筛选：全部' }).closest('span')?.className ?? ''
    expect(floating).toContain('right-4')
    expect(floating).toContain('sm:right-6')
    expect(floating).toContain('md:right-8')
  })

  it('选中态胶囊去掉描边：圆形态图标按 36px 居中，pr-2.5 才能与它同轴', () => {
    renderFilter('css')
    const btn = screen.getByRole('button', { name: '分类筛选：css' })
    expect(btn.className).toContain('border-0')
    expect(btn.className).toContain('pr-2.5')
    // 分类名在图标左侧，图标仍在最右
    const icon = btn.querySelector('svg')
    expect(icon?.nextSibling, '图标须是最后一个子元素').toBeNull()
    expect(btn.querySelector('.truncate')?.textContent).toBe('css')
  })

  /*
   * 选中态胶囊宽度曾靠 `w-auto` 覆盖 `size-9` 的 width 实现——但 tailwind-merge
   * 不把 size-* 与 w-* 视为同组冲突，两者都会保留，最终宽度只由 Tailwind 生成
   * CSS 时 .w-auto 恰好排在 .size-9 之后决定。这是对工具内部排序的隐式依赖，
   * 重排即失效（标签被裁）。现在 auto 模式只发高度类，不再发宽度类。
   */
  it('选中态是「只锁高度」的胶囊：不再发固定宽度类', () => {
    renderFilter('css')
    const btn = screen.getByRole('button', { name: '分类筛选：css' })
    expect(btn.className).toContain('h-9')
    expect(btn.className, '不应再带 size-9 —— 否则宽度只能靠 .w-auto 排在其后才生效').not.toContain('size-9')
  })

  it('未选中态仍是正方形图标按钮（size-9）', () => {
    renderFilter()
    expect(screen.getByRole('button', { name: '分类筛选：全部' }).className).toContain('size-9')
  })

  it('与 BackToTop 共用浮动栈档位：未滚动占 bottom-6，滚动后上抬让位', () => {
    renderFilter()
    const floating = () =>
      screen.getByRole('button', { name: '分类筛选：全部' }).closest('span')?.className ?? ''

    // 顶部时 BackToTop 不可见，本按钮就落在它的档位上，不悬空
    expect(floating()).toContain('bottom-6')

    // 滚过阈值后 BackToTop 出现，本按钮上抬一层，两者间留 gap-2
    window.scrollY = 400
    fireEvent.scroll(window)
    expect(floating()).toContain('bottom-[4.25rem]')

    expect(floating(), 'md 起走桌面侧栏，浮动按钮隐藏').toContain('md:hidden')
  })

  /*
   * 硬刷新且页面已滚动时，useScrolledPast 初值为 false，档位要在水合后的 effect
   * 里才纠正到上抬档。若 wrapper 不带过渡，这一步就是 44px 瞬移；带上 bottom 过渡
   * 后与目录按钮一致，是 200ms 平滑上浮。
   */
  it('档位切换带过渡：刷新时的档位纠正是滑动而非瞬移', () => {
    renderFilter()
    const floating = screen.getByRole('button', { name: '分类筛选：全部' }).closest('span')?.className ?? ''
    expect(floating).toContain('transition-[bottom')
    expect(floating).toContain('duration-200')
  })

  it('点开是底部抽屉，一次摊开全部分类且带条数', async () => {
    renderFilter()

    fireEvent.click(screen.getByRole('button', { name: '分类筛选：全部' }))

    const sheet = await screen.findByRole('dialog')

    // 「全部」带总数，其余带各自条数
    for (const name of ['全部 3', 'css 2', 'meta 1']) {
      expect(within(sheet).getByRole('button', { name })).toBeTruthy()
    }
    // 两列网格，横向不滚动
    const grid = sheet.querySelector('ul')
    expect(grid?.className).toContain('grid-cols-2')
    expect(sheet.innerHTML).not.toContain('overflow-x-auto')
  })

  it('「全部」计数取总条目数（含无分类），不是分类数之和', async () => {
    // CATS 之和为 3，但真实条目数为 5（有 2 条无分类）——「全部」即不筛选，计数须一致
    renderFilter(null, () => {}, 5)

    fireEvent.click(screen.getByRole('button', { name: '分类筛选：全部' }))
    const sheet = await screen.findByRole('dialog')

    expect(within(sheet).getByRole('button', { name: '全部 5' })).toBeTruthy()
    expect(within(sheet).queryByRole('button', { name: '全部 3' })).toBeNull()
  })

  it('抽屉里标出当前选中项', async () => {
    renderFilter('css')

    fireEvent.click(screen.getByRole('button', { name: '分类筛选：css' }))

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('button', { name: 'css 2' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(sheet).getByRole('button', { name: '全部 3' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('选中分类后回调用该名字并收起抽屉（一次点击完成）', async () => {
    const onSelect = vi.fn()
    renderFilter(null, onSelect)

    fireEvent.click(screen.getByRole('button', { name: '分类筛选：全部' }))
    const sheet = await screen.findByRole('dialog')
    fireEvent.click(within(sheet).getByRole('button', { name: 'meta 1' }))

    expect(onSelect).toHaveBeenCalledWith('meta')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('移动端不再有横滑药丸条；桌面侧栏整块隐藏到 md 起', () => {
    const { container } = renderFilter()

    const aside = container.querySelector('aside')?.className ?? ''
    expect(aside).toContain('hidden')
    expect(aside).toContain('md:block')
    expect(container.querySelector('aside ul')?.className ?? '').not.toContain('overflow-x-auto')
  })

  it('吸顶位置跟随 --header-height（桌面侧栏）', () => {
    const { container } = renderFilter()

    expect(container.querySelector('aside')?.className ?? '').toContain('top-[calc(var(--header-height)+1rem)]')
  })
})
