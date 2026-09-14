// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReadingProgress } from './reading-progress'

afterEach(() => {
  cleanup()
})

describe('ReadingProgress', () => {
  it('未滚动时静默隐藏，不占据空间', () => {
    const { container } = render(<ReadingProgress />)
    expect(container.firstChild).toBeNull()
  })
})
