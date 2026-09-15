// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useCopyText } from '@/components/primitives/use-copy-text'

beforeEach(() => {
  // jsdom 无 navigator.clipboard，按用例注入（成功/失败两种桩）
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function Harness({ resetMs }: { resetMs?: number }) {
  const { copied, copyText } = useCopyText(resetMs)
  return (
    <button type="button" onClick={() => void copyText('hello')}>
      {copied ? '已复制' : '复制'}
    </button>
  )
}

describe('useCopyText 正常渲染', () => {
  it('复制成功置位并按超时复位', async () => {
    vi.useFakeTimers()
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined)
    render(<Harness resetMs={1500} />)

    // findBy 与 fake timers 互斥：用 act 冲刷 clipboard promise 再断言
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '复制' }))
    })
    expect(screen.getByRole('button', { name: '已复制' })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByRole('button', { name: '复制' })).toBeTruthy()
  })
})

describe('useCopyText 异常渲染', () => {
  it('剪贴板不可用时不抛错、不置位', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('denied'))
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '复制' }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: '复制' })).toBeTruthy()
  })
})
