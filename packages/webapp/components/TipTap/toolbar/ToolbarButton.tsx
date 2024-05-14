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
            'outline-none tooltip tooltip-bottom p-0 size-8 btn-sm btn-ghost',
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
