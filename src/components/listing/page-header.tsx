/*
 * 列表页眉（posts / life / music / skills 路由页共用，同属列表组装）：
 * - 标题 + 说明文案；icon 传入裸图标，徽章框由组件统一包裹（四个索引页风格一致）
 */

export type PageHeaderProps = {
  title: string
  description?: string
  icon?: React.ReactNode
}

export function PageHeader({ title, description, icon }: PageHeaderProps) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="type-title flex items-center gap-2.5">
        {icon && (
          <span
            data-slot="page-header-icon"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4"
          >
            {icon}
          </span>
        )}
        {title}
      </h1>
      {description && <p className="type-body text-muted-foreground">{description}</p>}
    </div>
  )
}
