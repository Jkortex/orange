// 界面日期格式：统一 YYYY-MM-DD
export function formatDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
