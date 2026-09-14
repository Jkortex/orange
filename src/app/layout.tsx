import type { Metadata } from 'next'
import Link from 'next/link'
import { Citrus } from 'lucide-react'
import { ThemeSelect } from '@/components/theme-select'
import { ThemeToggle } from '@/components/theme-toggle'
import { PlayerProvider } from '@/components/player-provider'
import { PlayerBar } from '@/components/player-bar'
import { BackToTop } from '@/components/back-to-top'
import { SearchDialog } from '@/components/search-dialog'
import { HotkeyHelpModal } from '@/components/hotkey-help-modal'
import { RouteScrollReset } from '@/components/route-scroll-reset'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { HeaderNav } from '@/components/header-nav'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Orange', template: '%s · Orange' },
  description: '个人博客：文章、生活、摄影与音乐',
}

// 首帧前读取持久化的主题偏好（主题名 + 深浅色），防止闪烁；未设置时跟随系统
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme-name');if(t)document.documentElement.dataset.theme=t;var m=localStorage.getItem('theme-mode');var d=m?m==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})()`


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      data-theme="default"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://unpkg.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/harmonyos-sans-sc-webfont-splitted@1.1.0/dist/index.css"
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        {/* 全局播放状态 Provider：专辑卡/曲目列表经 usePlayer 入队，页面切换播放不中断（AGENTS.md 界面布局规范第 3 条）。
            播放条为 fixed 悬浮层（不占文档流、footer 不让位），无队列时零常驻留白 */}
        <PlayerProvider>
          {/* 顶栏全宽两端对齐（docs/specs/ui-ux.md §1.2）：品牌居左、导航与工具居右，不随内容区收窄；
              窄屏右侧组换行、各项仍可达 */}
          <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
            <nav className="flex w-full items-center justify-between gap-2 px-4 py-3 sm:py-4">
              <Link href="/" className="flex shrink-0 items-center gap-1.5 text-lg font-semibold hover:text-primary">
                <Citrus className="size-5 text-primary" aria-hidden />
                Orange
              </Link>
              <div className="flex items-center justify-end gap-x-2.5 sm:gap-x-3">
                <HeaderNav />
                <SearchDialog />
                <ThemeSelect className="hidden sm:inline-flex" />
                <ThemeToggle />
              </div>
            </nav>
          </header>
          {/* 宽度由各页面自持（文章页双栏 max-w-5xl，其余 max-w-2xl 居中），main 只管弹性与留白 */}
          <main className="w-full flex-1 px-4 py-8 pb-16">{children}</main>
          <PlayerBar />
          <BackToTop />
          <HotkeyHelpModal />
          <RouteScrollReset />
        </PlayerProvider>
      </body>
    </html>
  )
}
