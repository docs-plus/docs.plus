import type { ContextMenuRowVariant } from '@components/ui/ContextMenu'
import type { MouseEvent, ReactNode } from 'react'

export type MessageActionMenuItemId =
  | 'reply'
  | 'add-reaction'
  | 'copy-link'
  | 'download'
  | 'bookmark'
  | 'copy-to-doc'
  | 'reply-in-thread'
  | 'pin'
  | 'edit'
  | 'delete'
  | 'report'

export type MessageActionMenuItem = {
  id: MessageActionMenuItemId
  title: string
  icon: ReactNode
  onClickFn: (e?: MouseEvent) => void | Promise<void | boolean>
  display: boolean
  variant?: ContextMenuRowVariant
  separatorBefore?: boolean
  className?: string
}
