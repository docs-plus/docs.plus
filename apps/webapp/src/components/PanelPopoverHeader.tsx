import CloseButton from '@components/ui/CloseButton'
import type { ReactNode } from 'react'

type PanelPopoverHeaderProps = {
  title: string
  onClose: () => void
  actions?: ReactNode
}

export function PanelPopoverHeader({ title, onClose, actions }: PanelPopoverHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base-content text-base font-semibold">{title}</h2>
      <div className="flex items-center gap-1">
        {actions}
        <CloseButton onClick={onClose} size="sm" />
      </div>
    </div>
  )
}
