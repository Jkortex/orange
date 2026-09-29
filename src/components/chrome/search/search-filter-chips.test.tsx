// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  SearchFilterChips,
  stepScope,
} from '@/components/chrome/search/search-filter-chips'
import type { SearchScope } from '@/components/chrome/search/types'

afterEach(() => {
  cleanup()
})

/*
 * 受控包装：胶囊是过滤开关，选中态由父级回灌，
 * 才能验证「方向键直接切换」后 aria-pressed 与 roving tabindex 是否跟着走。
 */
function renderChips(initial: SearchScope = 'all') {
  const onSelectScope = vi.fn()

  function Wrapper() {
    const [scope, setScope] = useState<SearchScope>(initial)
    return (
      <SearchFilterChips
        activeScope={scope}
        onSelectScope={(next) => {
          onSelectScope(next)
          setScope(next)
        }}
      />
    )
  }

  render(<Wrapper />)
  const group = screen.getByRole('group', { name: '搜索范围过滤' })
  const chip = (name: string) => within(group).getByRole('button', { name })
  const pressed = (name: string) => chip(name).getAttribute('aria-pressed')
  const stops = () => within(group).getAllByRole('button').map((b) => b.tabIndex)

  return { onSelectScope, group, chip, pressed, stops }
}

describe('stepScope 范围顺序', () => {
  it('按 全部 → 文章 → 技能 → 生活 → 音乐 前进，末尾回绕到开头', () => {
    expect(stepScope('all', 1)).toBe('posts')
    expect(stepScope('music', 1)).toBe('all')
  })

  it('后退顺序相反，开头回绕到末尾', () => {
    expect(stepScope('posts', -1)).toBe('all')
    expect(stepScope('all', -1)).toBe('music')
  })
})

describe('SearchFilterChips 渲染', () => {
  it('渲染五个范围，当前范围 aria-pressed=true', () => {
    const { pressed } = renderChips('life')

    for (const name of ['全部', '文章', '技能', '生活', '音乐']) {
      expect(pressed(name)).toBe(name === '生活' ? 'true' : 'false')
    }
  })

  it('是过滤开关而非 tab：无 tablist/tabpanel 语义', () => {
    renderChips()

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('点击胶囊回调并切换选中态', () => {
    const { chip, pressed, onSelectScope } = renderChips()

    fireEvent.click(chip('技能'))

    expect(onSelectScope).toHaveBeenCalledWith('skills')
    expect(pressed('技能')).toBe('true')
    expect(pressed('全部')).toBe('false')
  })
})

describe('SearchFilterChips 键盘操作', () => {
  it('整组只占一个 Tab 停靠点，停靠点跟着当前范围走', () => {
    const { stops, chip } = renderChips()

    expect(stops()).toEqual([0, -1, -1, -1, -1])

    fireEvent.click(chip('生活'))
    expect(stops()).toEqual([-1, -1, -1, 0, -1])
  })

  /*
   * 步进基准是「当前激活范围」而非事件目标，所以每个 keydown 都要发给刚激活的那颗
   * ——真实使用中两者恒等（激活即移焦点），这也让 Shift+←/→ 从输入框改过范围后
   * 继续按 → 不会从过期的焦点位跳格。
   */
  it('组内 ←/→ 直接切换范围并移动焦点，首尾回绕', () => {
    const { chip, pressed } = renderChips()

    fireEvent.keyDown(chip('全部'), { key: 'ArrowRight' })
    expect(pressed('文章')).toBe('true')
    expect(document.activeElement).toBe(chip('文章'))

    fireEvent.keyDown(chip('文章'), { key: 'ArrowRight' })
    expect(pressed('技能')).toBe('true')

    fireEvent.keyDown(chip('技能'), { key: 'ArrowLeft' })
    expect(pressed('文章')).toBe('true')
    expect(document.activeElement).toBe(chip('文章'))

    // 走到末尾后继续 →：回绕到「全部」
    fireEvent.keyDown(chip('文章'), { key: 'ArrowRight' })
    fireEvent.keyDown(chip('技能'), { key: 'ArrowRight' })
    fireEvent.keyDown(chip('生活'), { key: 'ArrowRight' })
    expect(pressed('音乐')).toBe('true')

    fireEvent.keyDown(chip('音乐'), { key: 'ArrowRight' })
    expect(pressed('全部')).toBe('true')

    // 开头 ←：回绕到末尾
    fireEvent.keyDown(chip('全部'), { key: 'ArrowLeft' })
    expect(pressed('音乐')).toBe('true')
    expect(document.activeElement).toBe(chip('音乐'))
  })

  it('Home / End 跳到首尾', () => {
    const { chip, pressed } = renderChips('skills')

    fireEvent.keyDown(chip('技能'), { key: 'End' })
    expect(pressed('音乐')).toBe('true')
    expect(document.activeElement).toBe(chip('音乐'))

    fireEvent.keyDown(chip('音乐'), { key: 'Home' })
    expect(pressed('全部')).toBe('true')
  })

  /*
   * Shift+←/→ 是弹窗级的范围快捷键（search-dialog 挂在 DialogContent 上），
   * 组内必须让路，否则一次按键会被处理两遍、范围跳两格。
   */
  it('带修饰键的方向键不在组内处理，留给弹窗级快捷键', () => {
    const { chip, pressed, onSelectScope } = renderChips()

    fireEvent.keyDown(chip('全部'), { key: 'ArrowRight', shiftKey: true })
    fireEvent.keyDown(chip('全部'), { key: 'ArrowLeft', ctrlKey: true })
    fireEvent.keyDown(chip('全部'), { key: 'ArrowRight', metaKey: true })
    fireEvent.keyDown(chip('全部'), { key: 'ArrowRight', altKey: true })

    expect(onSelectScope).not.toHaveBeenCalled()
    expect(pressed('全部')).toBe('true')
  })

  it('无关按键不改变范围', () => {
    const { chip, pressed, onSelectScope } = renderChips()

    fireEvent.keyDown(chip('全部'), { key: 'ArrowDown' })
    fireEvent.keyDown(chip('全部'), { key: 'a' })

    expect(onSelectScope).not.toHaveBeenCalled()
    expect(pressed('全部')).toBe('true')
  })
})
