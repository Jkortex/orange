import { cn } from '@/lib/utils'

/*
 * 正文内嵌视频播放器（由 :::video 指令渲染，见 remark-video.ts）。
 * 用原生 <video controls>，无客户端 JS：样式走语义 token，不写死颜色。
 */

export interface VideoPlayerProps {
  src?: string
  poster?: string
  /** 无障碍名（aria-label），同时作为无 poster 时的兜底语义 */
  title?: string
  /** 图注，取自指令正文首个段落 */
  caption?: string
  className?: string
}

export function VideoPlayer({ src, poster, title, caption, className }: VideoPlayerProps) {
  if (!src) return null

  return (
    <figure className="my-6">
      <video
        controls
        playsInline
        preload="metadata"
        poster={poster || undefined}
        aria-label={title || '演示视频'}
        className={cn(
          'block w-full rounded-xl border border-border-subtle bg-surface',
          className,
        )}
      >
        <source src={src} type="video/mp4" />
        {/* 极老浏览器兜底：至少给一个下载入口 */}
        <a href={src} className="text-primary underline">
          下载视频
        </a>
      </video>
      {caption && (
        <figcaption className="type-caption mt-2 text-center text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
