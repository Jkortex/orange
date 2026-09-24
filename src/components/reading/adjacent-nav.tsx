'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useHotkey } from '@tanstack/react-hotkeys'
import type { CollectionType } from '@/lib/content'

export interface AdjacentNavProps {
  collection: CollectionType
  prev: { title: string; slug: string } | null
  next: { title: string; slug: string } | null
  className?: string
}

export function AdjacentNav({ collection, prev, next, className = '' }: AdjacentNavProps) {
  const prevRef = useRef<HTMLAnchorElement>(null)
  const nextRef = useRef<HTMLAnchorElement>(null)

  useHotkey('[', () => {
    if (prevRef.current) {
      prevRef.current.click()
    }
  })

  useHotkey(']', () => {
    if (nextRef.current) {
      nextRef.current.click()
    }
  })

  if (!prev && !next) return null

  const handleNav = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }

  return (
    <nav
      aria-label="相邻文章"
      className={`mt-12 grid grid-cols-1 gap-4 border-t border-border-subtle pt-8 sm:grid-cols-2 not-prose ${className}`}
    >
      {prev ? (
        <Link
          ref={prevRef}
          href={`/${collection}/${prev.slug}`}
          onClick={handleNav}
          className="surface-card surface-interactive group flex flex-col justify-between p-4"
        >
          <div className="type-meta flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
              <span>上一篇</span>
            </span>
            <kbd className="type-caption hidden rounded border border-border-subtle bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground sm:inline-block">
              [
            </kbd>
          </div>
          <span className="mt-2 block truncate font-medium text-foreground transition-colors group-hover:text-primary">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          ref={nextRef}
          href={`/${collection}/${next.slug}`}
          onClick={handleNav}
          className="surface-card surface-interactive group flex flex-col justify-between p-4 text-right sm:col-start-2"
        >
          <div className="type-meta flex items-center justify-between text-muted-foreground">
            <kbd className="type-caption hidden rounded border border-border-subtle bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground sm:inline-block">
              ]
            </kbd>
            <span className="flex items-center gap-1.5 font-medium">
              <span>下一篇</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </span>
          </div>
          <span className="mt-2 block truncate font-medium text-foreground transition-colors group-hover:text-primary">
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  )
}
