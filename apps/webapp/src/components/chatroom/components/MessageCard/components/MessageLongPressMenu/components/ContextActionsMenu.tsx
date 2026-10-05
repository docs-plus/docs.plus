import { UserReadStatus } from '@components/chatroom/components/MessageCard/components/common/UserReadStatus'
import {
  contextMenuPanelClassName,
  MenuListProvider,
  useMenuList
} from '@components/ui/ContextMenu'
import { useFloating, useMergeRefs } from '@floating-ui/react'
import { TMsgRow } from '@types'
import { twMerge } from '@utils/twMerge'
import { forwardRef, useCallback, useEffect } from 'react'

import { useMessageLongPressMenu } from '../MessageLongPressMenu'
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
    const { hideMenu } = useMessageLongPressMenu()
    const setOpen = useCallback(
      (open: boolean) => {
        if (!open) hideMenu()
      },
      [hideMenu]
    )

    // Floating UI runs the list keys only; the menu keeps its own position and motion.
    const { refs, context } = useFloating({ open: isVisible, onOpenChange: setOpen })
    // The long press owns Escape and the scrim tap, so it adds no dismiss interaction.
    const { getFloatingProps, listProps } = useMenuList(context, setOpen)
    const mergedRef = useMergeRefs([ref, refs.setFloating])

    // A pointer open focuses the panel, as `ContextMenu` does; the arrow keys then reach row 1.
    useEffect(() => {
      if (isVisible) refs.floating.current?.focus({ preventScroll: true })
    }, [isVisible, refs])

    return (
      <ul
        ref={mergedRef}
        {...getFloatingProps()}
        // useRole points aria-labelledby at a reference this menu does not have.
        aria-labelledby={undefined}
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
        <MenuListProvider {...listProps}>
          <LongPressMenuItems message={message} isInteractive={isInteractive} />
          <UserReadStatus message={message} />
        </MenuListProvider>
      </ul>
    )
  }
)

ContextActionsMenu.displayName = 'ContextActionsMenu'
