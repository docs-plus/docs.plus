import SharedButton, { type ButtonShape, type ButtonVariant } from '@components/ui/Button'
import { Placement } from '@floating-ui/react'
import { useTouchPress } from '@hooks/useTouchPress'
import { twMerge } from '@utils/twMerge'
import React from 'react'

import { useMessageComposer } from '../../hooks/useMessageComposer'

interface ToolbarButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  onPress?: (event: React.MouseEvent | React.TouchEvent) => void
  tooltip?: string
  tooltipPosition?: Placement
  isActive?: boolean
  variant?: ButtonVariant
  shape?: ButtonShape
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      onPress,
      children,
      tooltip,
      tooltipPosition = 'bottom',
      className,
      isActive,
      variant = 'ghost',
      shape,
      onPointerDown,
      onClick,
      ...rest
    },
    ref
  ) => {
    // Click is wired unconditionally below, unlike the pad button, which gates on `onPress`.
    // The hook's `preventDefault` on every click keeps the composer editor selection from being stolen.
    const { handleTouchEnd, handleClick } = useTouchPress(onPress, onClick)
    const { isMobile } = useMessageComposer()

    return (
      <SharedButton
        ref={ref}
        variant={variant}
        size="sm"
        shape={shape}
        className={twMerge(
          // /40 over daisyUI's /20 disabled ink, as the pad ToolbarButton sets.
          'rounded-field disabled:text-base-content/40 size-8 min-h-8 min-w-8 shrink-0 cursor-pointer touch-manipulation border-0 p-0 antialiased',
          isMobile && 'size-11 min-h-11 min-w-11',
          isActive && 'is-active btn-active',
          className
        )}
        onTouchEnd={onPress ? handleTouchEnd : undefined}
        onClick={handleClick}
        onPointerDown={onPointerDown}
        tooltip={tooltip}
        tooltipPlacement={tooltipPosition}
        {...rest}>
        {children}
      </SharedButton>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
