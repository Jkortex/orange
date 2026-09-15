/*
 * 锚点滚动复用（toc / mobile-toc-drawer / skill-package-explorer / search-dialog 共用）：
 * - 平滑滚动到指定 id，同步更新地址栏 hash（可回退、无抛错）
 * - 返回是否找到目标，便于调用方降级处理
 */

export function scrollToHeading(id: string, init?: ScrollIntoViewOptions): boolean {
  if (typeof document === 'undefined') return false
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', ...init })
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', `#${encodeURIComponent(id)}`)
  }
  return true
}
