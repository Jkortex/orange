import type { ComponentProps } from 'react'

export function EnDisclosure({
  children,
  ...rest
}: ComponentProps<'details'> & { node?: unknown }) {
  return (
    <details
      className="en-disclosure group my-3 overflow-hidden rounded-xl border border-border-subtle bg-muted/20 text-xs transition-colors hover:border-primary/30"
      {...rest}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2 font-medium text-muted-foreground select-none transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="flex size-4.5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
            EN
          </span>
          <span>英文原文与难词解析</span>
        </span>
        <span
          aria-hidden="true"
          className="text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-border-subtle/50 bg-background/50 px-3.5 py-3 text-foreground/90 leading-relaxed">
        {children}
      </div>
    </details>
  )
}
