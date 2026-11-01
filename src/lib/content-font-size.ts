export type ContentFontSize = 'sm' | 'base' | 'lg' | 'xl'

export interface FontSizeOption {
  id: ContentFontSize
  label: string
  size: string
}

export const DEFAULT_FONT_SIZE: ContentFontSize = 'base'

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { id: 'sm', label: '紧凑', size: '15px' },
  { id: 'base', label: '标准', size: '16px' },
  { id: 'lg', label: '中大', size: '18px' },
  { id: 'xl', label: '特大', size: '20px' },
]

export const CONTENT_FONT_SIZE_EVENT = 'orange:content-font-size-change' as const

export interface ContentFontSizeEventDetail {
  size: ContentFontSize
}

export function isContentFontSize(value: unknown): value is ContentFontSize {
  return typeof value === 'string' && FONT_SIZE_OPTIONS.some((opt) => opt.id === value)
}

/** 读取当前内容字号，未设或非法时回退到 base */
export function getContentFontSize(): ContentFontSize {
  if (typeof document === 'undefined') return DEFAULT_FONT_SIZE
  const current = document.documentElement.dataset.fontSize
  return isContentFontSize(current) ? current : DEFAULT_FONT_SIZE
}

/**
 * 设置内容字号的唯一客户端写入口：
 * 同步更新 DOM dataset.fontSize、写入 localStorage 持久化并广播自定义事件通知各 UI 组件
 */
export function setContentFontSize(size: ContentFontSize): ContentFontSize {
  const target = isContentFontSize(size) ? size : DEFAULT_FONT_SIZE

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.fontSize = target
  }

  try {
    localStorage.setItem('content-font-size', target)
  } catch {
    // 隐身模式/配额满时静默降级，保证当前会话正常生效
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ContentFontSizeEventDetail>(CONTENT_FONT_SIZE_EVENT, {
        detail: { size: target },
      }),
    )
  }

  return target
}
