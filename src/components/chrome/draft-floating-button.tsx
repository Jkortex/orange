'use client'

import { FilePenLine } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useOptionalPlayerIndex } from '@/components/player/player-provider'
import { IconButton } from '@/components/primitives/icon-button'
import {
  FLOATING_STACK_ANCHOR_LEFT,
  FLOATING_STACK_BUTTON,
  FLOATING_STACK_TIP_LEFT,
  draftStackOffset,
} from '@/lib/floating-stack'

/*
 * 草稿预览入口（仅本地开发渲染，见 app/layout.tsx 的 NODE_ENV 守卫）：
 * - 左下角浮动图标，与右下角浮动栈（回到顶部/目录）镜像，互不遮挡
 * - 竖向档位用 draftStackOffset(playerBar)：避让全宽播放条与左下角的 Next.js
 *   开发调试徽标（fixed bottom-20px left-20px），不套 useFloatingStackOffset()
 *   （那含给右侧回到顶部让位的滚动档位）
 * - 图标化按钮语义与全站一致：aria-label + hover/focus 提示，36px 触摸目标
 */

export function DraftFloatingButton() {
  const router = useRouter()
  const playerBar = useOptionalPlayerIndex() !== null

  return (
    <IconButton
      label="草稿（仅本地）"
      onClick={() => router.push('/drafts')}
      wrapperClassName={`${FLOATING_STACK_ANCHOR_LEFT} inline-flex ${draftStackOffset(playerBar)}`}
      buttonClassName={FLOATING_STACK_BUTTON}
      tipClassName={FLOATING_STACK_TIP_LEFT}
    >
      <FilePenLine className="size-4" aria-hidden />
    </IconButton>
  )
}
