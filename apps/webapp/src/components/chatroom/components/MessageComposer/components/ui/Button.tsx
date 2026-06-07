import SharedButton, { type ButtonShape, type ButtonVariant } from '@components/ui/Button'
import { Placement } from '@floating-ui/react'
import { Editor } from '@tiptap/react'
import React, { useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface ToolbarButtonProps {
  type?: string
  editor?: Editor | null
  onPress?: (event: React.MouseEvent | React.TouchEvent) => void
  children?: React.ReactNode
  tooltip?: string
  tooltipPosition?: Placement
  className?: string
  isActive?: boolean
  disabled?: boolean
  variant?: ButtonVariant
  shape?: ButtonShape
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      type,
      editor,
      onPress,
      children,
      tooltip,
      tooltipPosition = 'bottom',
      className,
      isActive,
      disabled,
      variant = 'ghost',
      shape,
      onPointerDown
    },
    ref
  ) => {
    const touchPressRef = useRef(false)
    const isButtonActive = isActive || editor?.isActive(type || '')

    function handleClick(e: React.MouseEvent) {
      e.preventDefault()
      if (touchPressRef.current) {
        touchPressRef.current = false
        return
      }
      onPress?.(e)
    }

    function handleTouchEnd(e: React.TouchEvent) {
      e.preventDefault()
      touchPressRef.current = true
      onPress?.(e)
    }

    return (
      <SharedButton
        ref={ref}
        variant={variant}
        size="sm"
        shape={shape}
        className={twMerge(
          'min-h-0 cursor-pointer touch-manipulation border-0 p-0 antialiased',
          isButtonActive && 'is-active btn-active',
          className
        )}
        onTouchEnd={editor && type && onPress ? handleTouchEnd : undefined}
        onClick={handleClick}
        onPointerDown={onPointerDown}
        disabled={disabled}
        tooltip={tooltip}
        tooltipPlacement={tooltipPosition}>
        {children}
      </SharedButton>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
