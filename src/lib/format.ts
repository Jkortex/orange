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
