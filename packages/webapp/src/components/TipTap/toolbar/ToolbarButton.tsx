import Button from '@components/ui/Button'
import { Placement } from '@floating-ui/react'
import type { Editor } from '@tiptap/core'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ToolbarButtonProps {
  type?: string
  editor?: Editor | null
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void
  onTouchEnd?: (event: React.TouchEvent) => void
  children: React.ReactNode
  tooltip?: string
  tooltipPlacement?: Placement
  className?: string
  isActive?: boolean
  disabled?: boolean
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      type,
      editor,
      onClick,
      onTouchEnd,
      children,
      tooltip,
      tooltipPlacement = 'bottom',
      className,
      isActive,
      disabled
    },
    ref
  ) => {
    const buttonClass = isActive || (type ? editor?.isActive(type) : false) ? 'is-active' : ''

    return (
      <Button
        ref={ref}
        className={twMerge('btn-ghost btn-sm size-8 p-0 outline-none', buttonClass, className)}
        onClick={onClick}
        onTouchEnd={onTouchEnd}
        disabled={disabled}
        tooltip={tooltip}
        tooltipPlacement={tooltipPlacement}>
        {children}
      </Button>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
