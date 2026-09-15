/*
 * 空态提示（首页 / 音乐页 / posts-explorer / skills-explorer 共用）：
 * - 虚线卡片 + 居中弱化文案；具体文案由调用方传入（测试断言各场景文案）
 */

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </p>
  )
}
