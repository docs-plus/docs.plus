import SharedButton from '@components/ui/Button'
import { Placement } from '@floating-ui/react'
import { Editor } from '@tiptap/react'
import React from 'react'
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
      disabled
    },
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
          'size-8 cursor-pointer touch-manipulation border-0 p-0 antialiased',
          isButtonActive && 'is-active btn-active',
          className
        )}
        onClick={(e) => {
          e.preventDefault()
          onPress?.(e)
        }}
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
