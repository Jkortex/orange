import type { ComponentProps } from 'react'

export function EnDisclosure({
  children,
  ...rest
}: ComponentProps<'details'> & { node?: unknown }) {
  return (
    <details
      className="en-disclosure not-prose group my-3 overflow-hidden rounded-xl border border-primary/25 bg-primary/5 text-xs transition-all hover:border-primary/45 hover:bg-primary/8"
      {...rest}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2 font-medium text-foreground/80 select-none transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            🌐 EN
          </span>
          <span className="font-semibold text-foreground">英文原文与难词解析</span>
          <span className="hidden sm:inline text-[11px] text-muted-foreground font-normal">
            · 点击展开 / 折叠
          </span>
        </span>
        <span
          aria-hidden="true"
          className="text-xs text-primary font-bold transition-transform duration-200 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-primary/15 bg-surface/90 px-4 py-3.5 text-foreground leading-relaxed space-y-2 [&>blockquote]:my-1.5 [&>blockquote]:border-l-2 [&>blockquote]:border-primary/50 [&>blockquote]:bg-primary/5 [&>blockquote]:px-3 [&>blockquote]:py-2 [&>blockquote]:rounded-r-md [&>blockquote]:italic [&>p]:my-1.5 [&>ul]:my-1.5 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:my-1">
        {children}
      </div>
    </details>
  )
}

