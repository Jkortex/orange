import { scrollToHeading } from '@/lib/scroll'
import type { UnifiedSearchItem } from './types'

interface PageHeading {
  id: string
  title: string
  depth: number
}

/*
 * 扫描当前页面的 H2 / H3 标题
 */
export function scanCurrentHeadings(): PageHeading[] {
  if (typeof document === 'undefined') return []

  const article = document.querySelector('article')
  const selector = article ? 'article h2[id], article h3[id]' : 'h2[id], h3[id]'
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))

  return elements.map((el) => {
    const rawText = el.textContent || el.innerText || ''
    return {
      id: el.id,
      title: rawText.replace(/^[#\s]+/, '').trim(),
      depth: el.tagName.toLowerCase() === 'h2' ? 2 : 3,
    }
  })
}

export function getOutlineItems(headings: PageHeading[], onClose: () => void): UnifiedSearchItem[] {
  return headings.map((h) => ({
    id: `heading-${h.id}`,
    kind: 'outline',
    title: h.title,
    subtitle: `页面小节 (H${h.depth})`,
    badge: `H${h.depth}`,
    onSelect: () => {
      onClose()
      jumpToHeading(h.id)
    },
  }))
}

export function filterOutlines(outlines: UnifiedSearchItem[], query: string): UnifiedSearchItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return outlines

  return outlines.filter((item) => {
    return item.title.toLowerCase().includes(q)
  })
}

function jumpToHeading(id: string) {
  if (!scrollToHeading(id, { block: 'center' })) return
  const target = document.getElementById(id)
  if (target) {
    target.classList.add('ring-2', 'ring-primary/60', 'rounded-md', 'transition-all', 'duration-300')
    setTimeout(() => {
      target.classList.remove('ring-2', 'ring-primary/60', 'rounded-md', 'transition-all', 'duration-300')
    }, 2000)
  }
}
