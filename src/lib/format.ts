// 界面字符串格式：日期、时长与排序（服务端与客户端共用，故不依赖 node 专有 API）
// 内容日期由 YAML 的日历日期解析为 UTC；统一取 UTC 字段，避免服务端/浏览器时区导致日期漂移。

/**
 * 不依赖运行环境的字典序（码位比较），保证 manifest、静态输出与客户端水合三者同序。
 *
 * 必须用它而不是 `localeCompare`：后者走 ICU 排序（中文按拼音、大小写/标点按语言规则），
 * 结果随宿主 locale 变化。静态导出的 HTML 在构建期烤死、却在访客浏览器里水合，
 * 两者一旦不同序，服务端渲染的列表就会与客户端不一致 —— React 报
 * “A tree hydrated but some attributes … didn't match”。
 */
export function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

export function formatDate(date: Date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 客户端条目惯例：服务端以 ISO 字符串内嵌日期，展示前转 Date（posts/skills-explorer 共用）
export function formatDateISO(iso: string) {
  return formatDate(new Date(iso))
}

// 播放时长格式：秒 → m:ss；时长未知（NaN/无限/负数）显示 --:--（规格 §5.3，不编造数字）
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 估算正文字数与阅读时长（中英混合），中文按 350 字/分、英文按 200 词/分 */
export function estimateReadingTime(content: string): { words: number; minutes: number } {
  // 简易剔除代码块与 HTML 标签，降低排版字符干扰
  const clean = content.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '')
  const cjk = (clean.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (clean.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9_-]+/g) || []).length
  const totalWords = cjk + words
  const minutes = Math.max(1, Math.ceil(cjk / 350 + words / 200))
  return { words: totalWords, minutes }
}
