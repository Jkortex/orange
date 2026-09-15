'use client'

import { useEffect, useRef, useState } from 'react'

/*
 * 复制反馈 hook（code-block / heading-anchor / skill-package-explorer 共用）：
 * - copyText 成功置 copied=true 并按 resetMs 自动复位；剪贴板异常返回 false，不抛错
 * - 卸载时清定时器；各调用方保留自有 aria-label 文案与超时（1500/2000）
 */

export function useCopyText(resetMs = 2000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), resetMs)
      return true
    } catch {
      return false
    }
  }

  return { copied, copyText }
}
