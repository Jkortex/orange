export type ThemeMode = 'light' | 'dark'

export const THEME_MODE_EVENT = 'orange:theme-mode-change' as const

export type ThemeModeEventDetail = {
  mode: ThemeMode
}

/** 主题模式的唯一客户端写入口：DOM、持久化与跨组件通知保持一致。 */
export function setThemeMode(mode: ThemeMode): ThemeMode {
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
  }

  try {
    localStorage.setItem('theme-mode', mode)
  } catch {
    // 隐私模式等存储不可用时，仍允许本次会话切换。
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ThemeModeEventDetail>(THEME_MODE_EVENT, {
        detail: { mode },
      }),
    )
  }

  return mode
}

export function getThemeMode(): ThemeMode {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function toggleThemeMode(): ThemeMode {
  return setThemeMode(getThemeMode() === 'dark' ? 'light' : 'dark')
}
