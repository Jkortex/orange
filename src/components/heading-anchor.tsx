'use client'

import { useState } from 'react'
import { Link as LinkIcon, Check } from 'lucide-react'

export interface HeadingWithAnchorProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as: 'h2' | 'h3'
  id?: string
  children: React.ReactNode
}

export function HeadingWithAnchor({
  as: Tag,
  id,
  children,
  className = '',
  ...props
}: HeadingWithAnchorProps) {
  const [copied, setCopied] = useState(false)

  if (!id) {
    return (
      <Tag className={className} {...props}>
        {children}
      </Tag>
    )
  }

  async function handleCopyAnchor(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()

    if (!id) return
    const url = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(id)}`

    try {
      await navigator.clipboard.writeText(url)
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', `#${encodeURIComponent(id)}`)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 降级静默忽略
    }
  }

  return (
    <Tag id={id} className={`group relative flex items-center gap-2 ${className}`} {...props}>
      <span>{children}</span>
      <button
        type="button"
        onClick={handleCopyAnchor}
        aria-label={copied ? '已复制链接' : '复制标题链接'}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-all duration-200 hover:bg-muted hover:text-foreground focus:opacity-100 ${
          copied ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        ) : (
          <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </Tag>
  )
}
