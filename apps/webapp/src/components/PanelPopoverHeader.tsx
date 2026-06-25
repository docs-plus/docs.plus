import CloseButton from '@components/ui/CloseButton'
import { usePopoverState } from '@components/ui/Popover'
import type { ReactNode } from 'react'

type PanelPopoverHeaderProps = {
  title: string
  onClose?: () => void
  showClose?: boolean
  actions?: ReactNode
}

export function PanelPopoverHeader({
  title,
  onClose,
  showClose = true,
  actions
}: PanelPopoverHeaderProps) {
  const { close: closePopover } = usePopoverState()
  const handleClose = onClose ?? closePopover

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base-content text-lg font-semibold">{title}</h2>
      <div className="flex items-center gap-1">
        {actions}
        {showClose && <CloseButton onClick={handleClose} size="sm" />}
      </div>
    </div>
  )
}
