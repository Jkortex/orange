'use client'

import { useState, useRef, useEffect, Children, isValidElement, type ReactNode } from 'react'
import { Check, Copy, Code2, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { useCopyText } from '@/components/primitives/use-copy-text'

export type CodeDemoProps = {
  title?: string
  html?: string
  css?: string
  js?: string
  children?: ReactNode
}

function buildSrcDoc(html: string, css: string, js: string, theme: string, isDark: boolean) {
  return `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html {
      margin: 0;
      padding: 0;
    }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: ${isDark ? '#f1f5f9' : '#0f172a'};
      line-height: 1.5;
      display: flow-root;
    }
    ${css}
  </style>
</head>
<body>
  ${html}
  ${js ? `<script>${js}<\/script>` : ''}
  <script>
    (function() {
      let lastSentHeight = 0;
      let lastWidth = window.innerWidth;

      function notifyHeight() {
        try {
          const body = document.body;
          if (!body) return;
          // body with display: flow-root contains all margins without stretching to viewport
          const h = Math.ceil(Math.max(body.offsetHeight, body.scrollHeight));
          if (h > 0 && Math.abs(h - lastSentHeight) > 1) {
            lastSentHeight = h;
            window.parent.postMessage({ type: 'orange-demo-resize', height: h }, '*');
          }
        } catch (e) {}
      }

      window.addEventListener('load', notifyHeight);
      window.addEventListener('resize', function() {
        if (window.innerWidth !== lastWidth) {
          lastWidth = window.innerWidth;
          notifyHeight();
        }
      });
      if (window.ResizeObserver && document.body) {
        new ResizeObserver(notifyHeight).observe(document.body);
      }
    })();
  <\/script>
</body>
</html>`
}

export function CodeDemo({
  title = '实时演示',
  html = '',
  css = '',
  js = '',
  children,
}: CodeDemoProps) {
  const [expanded, setExpanded] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeHeight, setIframeHeight] = useState(140)
  const [theme, setTheme] = useState('default')
  const [isDark, setIsDark] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 整理可选 Tab
  const availableTabs: { id: 'html' | 'css' | 'js'; label: string; code: string }[] = []
  if (html.trim()) availableTabs.push({ id: 'html', label: 'HTML', code: html })
  if (css.trim()) availableTabs.push({ id: 'css', label: 'CSS', code: css })
  if (js.trim()) availableTabs.push({ id: 'js', label: 'JS', code: js })

  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>(
    availableTabs[0]?.id ?? 'html',
  )

  const activeCode = availableTabs.find((t) => t.id === activeTab)?.code ?? ''
  const { copied, copyText } = useCopyText(2000)

  // 监听整站主题与深浅色模式，同步给 iframe
  useEffect(() => {
    function syncTheme() {
      const root = document.documentElement
      const dark = root.classList.contains('dark')
      const currentTheme = root.dataset.theme ?? 'default'
      setIsDark(dark)
      setTheme(currentTheme)

      if (iframeRef.current?.contentDocument?.documentElement) {
        const doc = iframeRef.current.contentDocument.documentElement
        doc.className = dark ? 'dark' : ''
        doc.dataset.theme = currentTheme
      }
    }

    syncTheme()

    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    return () => observer.disconnect()
  }, [])

  // 接收 iframe 自适应高度事件
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'orange-demo-resize' && typeof event.data.height === 'number') {
        const nextH = Math.max(100, Math.min(800, Math.ceil(event.data.height) + 4))
        setIframeHeight((prev) => (Math.abs(prev - nextH) <= 2 ? prev : nextH))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument
      if (doc?.body) {
        const h = Math.ceil(Math.max(doc.body.offsetHeight, doc.body.scrollHeight))
        if (h > 0) {
          const nextH = Math.max(100, Math.min(800, h + 4))
          setIframeHeight((prev) => (Math.abs(prev - nextH) <= 2 ? prev : nextH))
        }
      }
    } catch {}
  }

  // 筛选出对应当前 Tab 的高亮子节点（若有）
  const childArray = Children.toArray(children)
  const matchingChild = childArray.find((child) => {
    if (!isValidElement(child)) return false
    const demoLang = (child.props as Record<string, unknown>)['data-demo-lang']
    if (demoLang) {
      if (activeTab === 'html') return demoLang === 'html'
      if (activeTab === 'css') return demoLang === 'css'
      if (activeTab === 'js') return demoLang === 'js' || demoLang === 'javascript'
    }
    return false
  })

  return (
    <div className="surface-card group/demo not-prose my-8 overflow-hidden">
      {/* 演示顶栏 */}
      <div className="panel-bar flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Code2 className="size-3.5" aria-hidden />
          </span>
          <span className="type-caption font-semibold tracking-tight text-foreground">
            {title || '实时演示'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            aria-label="重置演示"
            title="重置演示"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>

          {availableTabs.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? '收起代码' : '查看代码'}
              className="surface-float type-caption inline-flex items-center gap-1 px-2.5 py-1 font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
            >
              <span>{expanded ? '收起代码' : '查看代码'}</span>
              {expanded ? (
                <ChevronUp className="size-3" aria-hidden />
              ) : (
                <ChevronDown className="size-3" aria-hidden />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 实时沙箱 Preview 区域 */}
      <div className="relative bg-background/50 p-1">
        <iframe
          key={iframeKey}
          ref={iframeRef}
          title={title || 'Demo Preview'}
          sandbox="allow-scripts allow-modals"
          loading="lazy"
          srcDoc={buildSrcDoc(html, css, js, theme, isDark)}
          onLoad={handleIframeLoad}
          style={{ height: `${iframeHeight}px` }}
          className="w-full border-0 transition-[height] duration-200"
        />
      </div>

      {/* 折叠代码区 */}
      {expanded && availableTabs.length > 0 && (
        <div className="border-t border-border-subtle">
          {/* Tab 栏 + 复制 */}
          <div className="panel-bar flex items-center justify-between border-b border-border-subtle px-3 py-1.5">
            <div className="flex items-center gap-1">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={activeTab === tab.id}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-background text-foreground shadow-card'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => copyText(activeCode)}
              aria-label={copied ? '已复制' : '复制代码'}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 type-caption text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-primary" aria-hidden />
                  <span className="text-primary font-medium">已复制</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden />
                  <span>复制</span>
                </>
              )}
            </button>
          </div>

          {/* 代码正文 */}
          <div className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            {matchingChild ? (
              matchingChild
            ) : (
              <pre className="m-0 p-2 text-foreground whitespace-pre">
                <code>{activeCode}</code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
