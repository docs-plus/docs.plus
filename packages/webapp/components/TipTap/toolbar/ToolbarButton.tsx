import React from 'react'

import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/Tooltip'
import Button from '@components/ui/Button'

const ToolbarButton = React.forwardRef(
  ({ type, editor, onClick, children, tooltip, position }: any, ref: any) => {
    const buttonClass = editor?.isActive(type) ? 'is-active' : ''

    return (
      <span ref={ref}>
        <Tooltip placement="bottom">
          <TooltipTrigger asChild={true}>
            <Button
              className={buttonClass + ' outline-none p-0 size-8 btn-sm btn-ghost'}
              onClick={onClick}>
              {children}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="Tooltip z-10">{tooltip}</TooltipContent>
        </Tooltip>
      </span>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
