import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Editor } from '@tiptap/react'

interface ButtonProps {
  type?: string
  editor?: Editor | null
  onPress?: (event: React.MouseEvent | React.TouchEvent) => void
  children?: React.ReactNode
  tooltip?: string
  tooltipPosition?: 'tooltip-top' | 'tooltip-bottom' | 'tooltip-left' | 'tooltip-right'
  className?: string
  isActive?: boolean
  disabled?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { type, editor, onPress, children, tooltip, tooltipPosition, className, isActive, disabled },
    ref
  ) => {
    const handleTouchEnd = (event: React.TouchEvent) => {
      event.preventDefault() // Prevent subsequent click event
      onPress?.(event)
    }

    return (
      <button
        ref={ref}
        className={twMerge(
          'btn btn-ghost btn-sm tooltip tooltip-bottom flex size-8 cursor-pointer items-center justify-center border-0 p-0 antialiased outline-none',
          (isActive || editor?.isActive(type || '')) && 'is-active btn-active',
          tooltipPosition,
          className
        )}
        onClick={onPress}
        onTouchEnd={handleTouchEnd}
        data-tip={tooltip}
        disabled={disabled}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
