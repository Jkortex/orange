import type { Metadata } from 'next'
import Link from 'next/link'
import { ThemeSelect } from '@/components/chrome/theme-select'
import { ThemeToggle } from '@/components/chrome/theme-toggle'
import { PlayerProvider } from '@/components/player/player-provider'
import { PlayerBarLoader } from '@/components/chrome/player-bar-loader'
import { BackToTop } from '@/components/chrome/back-to-top'
import { DraftFloatingButton } from '@/components/chrome/draft-floating-button'
import { SearchDialog } from '@/components/chrome/search-dialog'
import { HotkeyHelpModal } from '@/components/chrome/hotkey-help-modal'
import { RouteScrollReset } from '@/components/chrome/route-scroll-reset'
import { GeistMono } from 'geist/font/mono'
import { HeaderNav } from '@/components/chrome/header-nav'
import { MobileNavDrawer } from '@/components/chrome/mobile-nav-drawer'
import { BrandMark } from '@/components/chrome/brand-mark'
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
      className={GeistMono.variable}
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
          {/* 顶栏全宽单行（AGENTS.md 界面布局规范第 1 条，sticky z-40）：
              品牌居左；栏目导航与搜索/主题同处右侧簇。移动端导航收进汉堡侧滑抽屉，
              sm 起改为行内文字导航（display:none 让读屏与 Tab 顺序一并让位）。高度取自
              --header-height，分类条吸顶与锚点避让都跟着它走 */}
          <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
            <nav className="flex min-h-[var(--header-height)] w-full items-center gap-x-2 px-4 py-2.5 sm:px-6 sm:py-3">
              <Link href="/" className="type-item flex shrink-0 items-center gap-2 font-semibold transition-colors hover:text-primary">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                  <BrandMark className="size-4 text-primary" />
                </span>
                Orange
              </Link>

              <div className="ml-auto flex items-center gap-x-1 sm:gap-x-2">
                {/* 行内文字导航只在 sm 及以上出现，移动端由 MobileNavDrawer 承担 */}
                <div className="hidden sm:block">
                  <HeaderNav />
                </div>
                <MobileNavDrawer />
                <span aria-hidden="true" className="mx-1 hidden h-4 w-px bg-border/70 sm:inline-block" />
                <SearchDialog />
                <ThemeSelect className="hidden sm:inline-flex" />
                <ThemeToggle />
              </div>
            </nav>
          </header>
          {/* 宽度由各页面自持（文章页双栏 max-w-5xl，其余 max-w-2xl 居中），main 只管弹性与留白。
              底部不再为固定播放条预留（那是 PlayerBarLoader 的占位块的事），
              否则列表与页尾之间会凭空多出一大段空白 */}
          <main
            data-pagefind-body
            className="w-full flex-1 px-4 py-10 sm:px-6 sm:py-12"
          >
            {children}
          </main>
          <footer className="border-t border-border-subtle">
            <div className="type-meta flex w-full flex-col gap-3 px-4 py-8 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="flex items-center gap-1.5">
                <BrandMark className="size-4 text-primary/70" />
                <span>
                  Orange · 记录编程技术、生活随想与音乐
                </span>
              </p>
              <nav aria-label="页脚" className="type-meta flex items-center gap-4">
                <Link href="/rss.xml" className="transition-colors hover:text-foreground">RSS</Link>
                <span aria-hidden="true" className="h-3 w-px bg-border" />
                <span className="tabular-nums">© {new Date().getFullYear()}</span>
              </nav>
            </div>
            {/* 播放条覆盖页尾时，PlayerBarLoader 的占位块已把 footer 顶出覆盖范围；
                这里只留 iOS 底部手势条的安全区 */}
            <div className="h-[env(safe-area-inset-bottom)]" aria-hidden="true" />
          </footer>
          <PlayerBarLoader />
          <BackToTop />
          {/* 草稿预览入口：仅本地开发渲染（server 侧静态内联，生产构建分支为 false 直接消除） */}
          {process.env.NODE_ENV === 'development' && <DraftFloatingButton />}
          <HotkeyHelpModal />
          <RouteScrollReset />
        </PlayerProvider>
      </body>
    </html>
  )
}
