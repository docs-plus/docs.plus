import { MessageMenuReadStatus } from '@components/chatroom/components/MessageCard/components/common/MessageMenuReadStatus'
import { contextMenuPanelClassName } from '@components/ui/ContextMenu'
import { TMsgRow } from '@types'
import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

import { LongPressMenuItems } from './ContextMenuItems'

interface ContextActionsMenuProps {
  position: { x: number; y: number }
  isVisible: boolean
  isInteractive?: boolean
  className?: string
  message: TMsgRow
}

export const ContextActionsMenu = forwardRef<HTMLUListElement, ContextActionsMenuProps>(
  ({ position, isVisible, isInteractive = true, className, message }, ref) => {
    return (
      <ul
        ref={ref}
        className={twMerge(
          contextMenuPanelClassName,
          'min-w-[12rem] transition-all duration-200 ease-out',
          className
        )}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: isVisible
            ? 'translateX(-50%) translateY(0) scale(1)'
            : 'translateX(-50%) translateY(20px) scale(0.9)',
          opacity: isVisible ? 1 : 0
        }}
        onClick={(e) => e.stopPropagation()}>
        <LongPressMenuItems message={message} isInteractive={isInteractive} />
        <MessageMenuReadStatus message={message} isOpen wrapper="li" className="px-2.5 py-2" />
      </ul>
    )
  }
)

ContextActionsMenu.displayName = 'ContextActionsMenu'
