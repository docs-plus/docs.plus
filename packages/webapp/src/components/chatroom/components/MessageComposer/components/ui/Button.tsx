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
    return (
      <button
        ref={ref}
        className={twMerge(
          'btn btn-ghost btn-sm tooltip tooltip-bottom flex size-8 cursor-pointer touch-manipulation items-center justify-center border-0 p-0 antialiased outline-none',
          (isActive || editor?.isActive(type || '')) && 'is-active btn-active',
          tooltipPosition,
          className
        )}
        onClick={(e) => {
          e.preventDefault()
          onPress?.(e)
        }}
        data-tip={tooltip}
        disabled={disabled}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
