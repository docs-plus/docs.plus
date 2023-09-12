import React from 'react'

import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/Tooltip'

const ToolbarButton = React.forwardRef(({ type, editor, onClick, children, tooltip }, ref) => {
  const buttonClass = editor?.isActive(type) ? 'is-active' : ''

  return (
    <span ref={ref}>
      <Tooltip placement="bottom">
        <TooltipTrigger asChild={true}>
          <button className={buttonClass} onClick={onClick}>
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent className="Tooltip z-10">{tooltip}</TooltipContent>
      </Tooltip>
    </span>
  )
})

ToolbarButton.displayName = 'ToolbarButton'

export default ToolbarButton
