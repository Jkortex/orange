import type { UnifiedSearchItem } from './types'

export interface ActionContext {
  onClose: () => void
  player?: {
    queue: unknown[]
    playing: boolean
    toggle: () => void
    playAlbum: (tracks: Array<{ title: string; file: string }>) => void
  } | null
}

/*
 * 注册支持自然语义检索的系统快捷动作
 * 用户无需输入任何前缀，只要搜索“深色”、“音乐”、“首页”等即可匹配
 */
export function getSystemActions(ctx: ActionContext): UnifiedSearchItem[] {
  const { onClose, player } = ctx

  const actions: UnifiedSearchItem[] = [
    {
      id: 'action-theme-toggle',
      kind: 'action',
      title: '切换深色 / 浅色模式',
      subtitle: '快速在浅色和深色主题外观之间切换',
      badge: '外观',
      keywords: ['主题', 'theme', 'dark', 'light', '黑夜', '白天', '模式'],
      onSelect: () => {
        onClose()
        const isDark = document.documentElement.classList.contains('dark')
        if (isDark) {
          document.documentElement.classList.remove('dark')
          localStorage.setItem('theme-mode', 'light')
        } else {
          document.documentElement.classList.add('dark')
          localStorage.setItem('theme-mode', 'dark')
        }
      },
    },
    {
      id: 'action-nav-home',
      kind: 'action',
      title: '前往博客首页',
      subtitle: '浏览全站混合时间线',
      badge: '导航',
      keywords: ['首页', 'home', '主页', 'index'],
      onSelect: () => {
        onClose()
        window.location.href = '/'
      },
    },
    {
      id: 'action-nav-posts',
      kind: 'action',
      title: '前往文章列表',
      subtitle: '浏览所有技术文章与分类',
      badge: '导航',
      keywords: ['文章', 'posts', '博客', 'blog', '技术'],
      onSelect: () => {
        onClose()
        window.location.href = '/posts'
      },
    },
    {
      id: 'action-nav-skills',
      kind: 'action',
      title: '前往技能清单',
      subtitle: '查看标准化专业工程技能包',
      badge: '导航',
      keywords: ['技能', 'skills', '专业', '清单', 'skill'],
      onSelect: () => {
        onClose()
        window.location.href = '/skills'
      },
    },
    {
      id: 'action-nav-life',
      kind: 'action',
      title: '前往生活随想',
      subtitle: '查看生活碎片、摄影与随笔',
      badge: '导航',
      keywords: ['生活', 'life', '随笔', '日常', '摄影'],
      onSelect: () => {
        onClose()
        window.location.href = '/life'
      },
    },
    {
      id: 'action-nav-music',
      kind: 'action',
      title: '前往音乐馆',
      subtitle: '沉浸式浏览精选音乐专辑',
      badge: '导航',
      keywords: ['音乐', 'music', '播放器', '歌单', '专辑', '歌曲'],
      onSelect: () => {
        onClose()
        window.location.href = '/music'
      },
    },
    {
      id: 'action-scroll-top',
      kind: 'action',
      title: '回到页面顶部',
      subtitle: '平滑滚动到当前页面最上方',
      badge: '滚动',
      keywords: ['回到顶部', '置顶', 'top', 'scroll', '向上'],
      onSelect: () => {
        onClose()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      },
    },
  ]

  if (player) {
    actions.push({
      id: 'action-player-toggle',
      kind: 'action',
      title: player.playing ? '暂停音乐播放' : '继续音乐播放',
      subtitle: player.playing ? '暂停当前背景音乐' : '继续播放音乐队列',
      badge: '音乐',
      keywords: ['播放', '暂停', '音乐', 'player', 'play', 'pause'],
      onSelect: () => {
        onClose()
        player.toggle()
      },
    })
  }

  return actions
}

export function filterActions(actions: UnifiedSearchItem[], query: string): UnifiedSearchItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  return actions.filter((act) => {
    const titleMatch = act.title.toLowerCase().includes(q)
    const subMatch = act.subtitle ? act.subtitle.toLowerCase().includes(q) : false
    const badgeMatch = act.badge ? act.badge.toLowerCase().includes(q) : false
    const keywordsMatch = act.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false
    return titleMatch || subMatch || badgeMatch || keywordsMatch
  })
}
