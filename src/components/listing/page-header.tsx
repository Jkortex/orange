/*
 * 列表页眉（posts / skills / music 路由页共用，同属列表组装）：
 * - 标题 + 说明文案；music 传入小图标徽章
 */

export type PageHeaderProps = {
  title: string
  description?: string
  icon?: React.ReactNode
}

export function PageHeader({ title, description, icon }: PageHeaderProps) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
        {icon}
        {title}
      </h1>
      {description && (
        <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
