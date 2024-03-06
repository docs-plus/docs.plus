import React from 'react'
import Button from '@components/ui/Button'

const ToolbarButton = React.forwardRef(
  ({ type, editor, onClick, children, tooltip, position }: any, ref: any) => {
    const buttonClass = editor?.isActive(type) ? 'is-active' : ''

    return (
      <span ref={ref}>
        <Button
          className={
            buttonClass + 'outline-none tooltip tooltip-bottom p-0 size-8 btn-sm btn-ghost'
          }
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
