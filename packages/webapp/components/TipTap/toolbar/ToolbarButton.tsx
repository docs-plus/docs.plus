import React from 'react'
import Button from '@components/ui/Button'
import { twMerge } from 'tailwind-merge'

interface ToolbarButtonProps {
  type?: string
  editor?: any // Consider replacing 'any' with a more specific editor type if available
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void
  onTouchEnd?: (event: React.TouchEvent) => void
  children: React.ReactNode
  tooltip?: string
  position?: string
  className?: string
  isActive?: boolean
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    { type, editor, onClick, onTouchEnd, children, tooltip, position, className, isActive },
    ref
  ) => {
    const buttonClass = isActive || editor?.isActive(type) ? 'is-active' : ''

    return (
      <Button
        ref={ref}
        className={twMerge(
          'btn-ghost btn-sm tooltip tooltip-bottom size-8 p-0 outline-none',
          buttonClass,
          position,
          className
        )}
        onClick={onClick}
        onTouchEnd={onTouchEnd}
        data-tip={tooltip}>
        {children}
      </Button>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
