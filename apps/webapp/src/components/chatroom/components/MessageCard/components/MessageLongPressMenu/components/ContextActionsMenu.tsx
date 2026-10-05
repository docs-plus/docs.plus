import { UserReadStatus } from '@components/chatroom/components/MessageCard/components/common/UserReadStatus'
import { contextMenuPanelClassName } from '@components/ui/ContextMenu'
import { TMsgRow } from '@types'
import { twMerge } from '@utils/twMerge'
import { forwardRef } from 'react'

import { LongPressMenuItems } from './ContextMenuItems'
import { longPressMotionClass } from './longPressMotion'

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
        role="menu"
        aria-label="Message options"
        className={twMerge(contextMenuPanelClassName, longPressMotionClass(isVisible), className)}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: isVisible
            ? 'translateX(-50%) translateY(0) scale(1)'
            : 'translateX(-50%) translateY(8px) scale(0.96)',
          opacity: isVisible ? 1 : 0
        }}
        onClick={(e) => e.stopPropagation()}>
        <LongPressMenuItems message={message} isInteractive={isInteractive} />
        <UserReadStatus message={message} isOpen />
      </ul>
    )
  }
)

ContextActionsMenu.displayName = 'ContextActionsMenu'
