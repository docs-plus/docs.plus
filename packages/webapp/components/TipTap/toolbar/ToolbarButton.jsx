import React from 'react'

import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/Tooltip'

const ToolbarButton = ({ type, editor, onClick, children, tooltip }) => {
  const buttonClass = editor?.isActive(type) ? 'is-active' : ''

  return (
    <Tooltip placement="bottom">
      <TooltipTrigger asChild={true}>
        <button className={buttonClass} onClick={onClick}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="Tooltip">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export default ToolbarButton
