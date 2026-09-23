import { animateThemeChange } from '@/lib/theme-transition'
import type { CommandItem } from './types'

type PlayerLike = { clear: () => void } | null

export function buildCommands(player: PlayerLike): CommandItem[] {
  return [
    {
      id: 'theme-toggle',
      title: '切换深浅主题',
      desc: '在明亮与暗黑风格之间快速切换',
      keys: 't',
      run: () => {
        animateThemeChange(() => {
          const isDark = !document.documentElement.classList.contains('dark')
          document.documentElement.classList.toggle('dark', isDark)
          try {
            localStorage.setItem('theme-mode', isDark ? 'dark' : 'light')
          } catch {
            // localStorage 不可用时静默降级
          }
        })
      },
    },
    {
      id: 'nav-home',
      title: '前往博客首页',
      desc: '返回站点首页综合时间线',
      keys: 'g h',
      run: () => {
        window.location.href = '/'
      },
    },
    {
      id: 'nav-posts',
      title: '查看文章专栏',
      desc: '浏览博客全部分类与深度技术文章',
      run: () => {
        window.location.href = '/posts'
      },
    },
    {
      id: 'nav-life',
      title: '查看生活随笔',
      desc: '浏览日常碎片、随笔与随手拍',
      run: () => {
        window.location.href = '/life'
      },
    },
    {
      id: 'nav-music',
      title: '查看音乐合辑',
      desc: '收听精选音乐专辑并随心播放',
      run: () => {
        window.location.href = '/music'
      },
    },
    {
      id: 'nav-skills',
      title: '查看技能目录',
      desc: '探索可交互的开发技能包与工作流',
      run: () => {
        window.location.href = '/skills'
      },
    },
    {
      id: 'clear-music',
      title: '清空播放队列',
      desc: '清除全局音频播放条中的所有曲目',
      run: () => {
        player?.clear()
      },
    },
    {
      id: 'hotkey-help',
      title: '显示快捷键指南',
      desc: '查看全站所有快捷操作速查表',
      keys: '?',
      run: () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
      },
    },
  ]
}

export function filterCommands(
  commands: CommandItem[],
  keyword: string,
): CommandItem[] {
  if (!keyword) return commands
  const lower = keyword.toLowerCase()
  return commands.filter(
    (c) =>
      c.title.toLowerCase().includes(lower) ||
      c.desc.toLowerCase().includes(lower),
  )
}
