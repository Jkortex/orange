import type { Metadata } from 'next'
import Link from 'next/link'
import { Citrus } from 'lucide-react'
import { ThemeSelect } from '@/components/chrome/theme-select'
import { ThemeToggle } from '@/components/chrome/theme-toggle'
import { PlayerProvider } from '@/components/player/player-provider'
import { PlayerBar } from '@/components/chrome/player-bar'
import { BackToTop } from '@/components/chrome/back-to-top'
import { SearchDialog } from '@/components/chrome/search-dialog'
import { HotkeyHelpModal } from '@/components/chrome/hotkey-help-modal'
import { RouteScrollReset } from '@/components/chrome/route-scroll-reset'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { HeaderNav } from '@/components/chrome/header-nav'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Orange', template: '%s · Orange' },
  description: '个人博客：文章、生活、摄影与音乐',
}

// 首帧前读取持久化的主题偏好（主题名 + 深浅色），防止闪烁；未设置时跟随系统
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme-name');if(t)document.documentElement.dataset.theme=t;var m=localStorage.getItem('theme-mode');var d=m?m==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})()`


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
        {/* 正文衬线：霞鹜文楷（unicode-range 分片，按需加载；--font-serif 首项） */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/lxgw-wenkai-webfont@1.7.0/style.css"
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        {/* 全局播放状态 Provider：专辑卡/曲目列表经 usePlayer 入队，页面切换播放不中断（AGENTS.md 界面布局规范第 3 条）。
            播放条为 fixed 悬浮层（不占文档流、footer 不让位），无队列时零常驻留白 */}
        <PlayerProvider>
          {/* 顶栏全宽两端对齐：品牌居左、导航与工具居右，不随内容区收窄；
              窄屏右侧组换行、各项仍可达 */}
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 shadow-[0_1px_0_rgb(0_0_0/0.02)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
            <nav className="flex w-full items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-3.5">
              <Link href="/" className="flex shrink-0 items-center gap-2 text-[17px] font-semibold tracking-tight transition-colors hover:text-primary">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                  <Citrus className="size-4 text-primary" aria-hidden />
                </span>
                Orange
              </Link>
              <div className="flex items-center justify-end gap-x-1 sm:gap-x-2">
                <HeaderNav />
                <span aria-hidden="true" className="mx-1 hidden h-4 w-px bg-border/70 sm:inline-block" />
                <SearchDialog />
                <ThemeSelect className="hidden sm:inline-flex" />
                <ThemeToggle />
              </div>
            </nav>
          </header>
          {/* 宽度由各页面自持（文章页双栏 max-w-5xl，其余 max-w-2xl 居中），main 只管弹性与留白 */}
          <main className="w-full flex-1 px-4 py-10 sm:px-6 sm:py-12 pb-20">{children}</main>
          <footer className="border-t border-border/60">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="flex items-center gap-1.5">
                <Citrus className="size-4 text-primary/70" aria-hidden />
                <span>
                  Orange · 记录编程技术、生活随想与音乐
                </span>
              </p>
              <nav aria-label="页脚" className="flex items-center gap-4 text-sm">
                <Link href="/rss.xml" className="transition-colors hover:text-foreground">RSS</Link>
                <span aria-hidden="true" className="h-3 w-px bg-border" />
                <span className="tabular-nums">© {new Date().getFullYear()}</span>
              </nav>
            </div>
            {/* 播放条悬浮覆盖页脚下缘时，此处留白保证 footer 内容始终可读 */}
            <div className="h-[env(safe-area-inset-bottom)]" aria-hidden="true" />
          </footer>
          <PlayerBar />
          <BackToTop />
          <HotkeyHelpModal />
          <RouteScrollReset />
        </PlayerProvider>
      </body>
    </html>
  )
}
