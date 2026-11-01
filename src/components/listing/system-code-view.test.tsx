// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SystemCodeView } from './system-code-view'

afterEach(() => {
  cleanup()
})

describe('SystemCodeView 代码预览器', () => {
  it('正确渲染代码内容与行号', () => {
    const code = 'package main\n\nfunc main() {\n  println("hello")\n}'
    render(<SystemCodeView content={code} path="cmd/main.go" />)

    expect(screen.getByText('package main')).toBeTruthy()
    // 检查行号 1, 2, 3, 4, 5
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('支持切换代码自动折行模式', () => {
    const code = 'const longLine = "very long line here"'
    render(<SystemCodeView content={code} path="index.ts" />)

    const wrapBtn = screen.getByRole('button', { name: /折行/ })
    expect(wrapBtn.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(wrapBtn)
    expect(wrapBtn.getAttribute('aria-pressed')).toBe('true')
  })
})
