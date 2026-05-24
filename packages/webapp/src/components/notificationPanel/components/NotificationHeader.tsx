import CloseButton from '@components/ui/CloseButton'
import { usePopoverState } from '@components/ui/Popover'

import { NotificationMarkAllReadButton } from './NotificationMarkAllReadButton'

interface NotificationHeaderProps {
  onClose?: () => void
  showClose?: boolean
}

export const NotificationHeader = ({ onClose, showClose = true }: NotificationHeaderProps) => {
  const popoverState = usePopoverState()
  const handleClose = onClose || popoverState.close

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base-content text-lg font-semibold">Notifications</h2>

      <div className="flex items-center gap-1">
        <NotificationMarkAllReadButton />
        {showClose && <CloseButton onClick={handleClose} size="sm" />}
      </div>
    </div>
  )
}
