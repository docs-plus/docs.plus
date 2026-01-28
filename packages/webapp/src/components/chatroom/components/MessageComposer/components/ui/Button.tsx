import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Editor } from '@tiptap/react'
import SharedButton from '@components/ui/Button'

interface ToolbarButtonProps {
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

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    { type, editor, onPress, children, tooltip, tooltipPosition, className, isActive, disabled },
    ref
  ) => {
    const isButtonActive = isActive || editor?.isActive(type || '')

    return (
      <SharedButton
        ref={ref}
        variant="ghost"
        size="sm"
        shape="square"
        className={twMerge(
          'tooltip tooltip-bottom size-8 cursor-pointer touch-manipulation border-0 p-0 antialiased',
          isButtonActive && 'is-active btn-active',
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
      </SharedButton>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
