/*
 * 站点品牌标（header / footer 共用，品牌图形仅此一处）：
 * 环 + 叶——兼作字母 O；单色 currentColor，随所在文字色走，不引入第三个品牌色。
 * 与站点图标 src/app/icon.svg 同形，只差配色策略（图标是独立文件，用固定品牌橙）。
 */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="15.5" cy="19.5" r="9.5" stroke="currentColor" strokeWidth="5.2" />
      <path d="M19 9.2Q28.06 10.51 27.2 1.4Q18.14 0.09 19 9.2Z" fill="currentColor" />
    </svg>
  )
}
