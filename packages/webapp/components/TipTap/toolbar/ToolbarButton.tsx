import React from 'react'
import Button from '@components/ui/Button'
import { twMerge } from 'tailwind-merge'

const ToolbarButton = React.forwardRef(
  ({ type, editor, onClick, children, tooltip, position }: any, ref: any) => {
    const buttonClass = editor?.isActive(type) ? 'is-active' : ''

    return (
      <span ref={ref}>
        <Button
          className={twMerge(
            'btn-ghost btn-sm tooltip tooltip-bottom size-8 p-0 outline-none',
            buttonClass,
            position
          )}
          onClick={onClick}
          data-tip={tooltip}>
          {children}
        </Button>
      </span>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
