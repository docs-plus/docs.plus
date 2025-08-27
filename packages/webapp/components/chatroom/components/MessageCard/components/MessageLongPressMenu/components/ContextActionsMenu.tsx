import { forwardRef } from 'react'
import { LongPressMenuItems } from './ContextMenuItems'
import { UserReadStatus } from './UserReadStatus'
import { useMessageCardContext } from '../../../MessageCardContext'

interface ContextActionsMenuProps {
  position: { x: number; y: number }
  isVisible: boolean
  isInteractive?: boolean
  className?: string
}

export const ContextActionsMenu = forwardRef<HTMLUListElement, ContextActionsMenuProps>(
  ({ position, isVisible, isInteractive = true, className }, ref) => {
    const { message } = useMessageCardContext()
    return (
      <ul
        ref={ref}
        className={`menu bg-base-100 z-20 m-0 w-48 rounded-lg p-2 shadow transition-all duration-200 ease-out outline-none ${className || ''}`}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: isVisible
            ? 'translateX(-50%) translateY(0) scale(1)'
            : 'translateX(-50%) translateY(10px) scale(0.9)',
          opacity: isVisible ? 1 : 0
        }}
        onClick={(e) => e.stopPropagation()}>
        <LongPressMenuItems message={message} isInteractive={isInteractive} />
        <div className="mt-1 border-t border-gray-300 pt-1">
          <UserReadStatus message={message} />
        </div>
      </ul>
    )
  }
)

ContextActionsMenu.displayName = 'ContextActionsMenu'
