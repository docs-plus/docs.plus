import { LuCheckCheck } from 'react-icons/lu'
import { useMarkAllNotificationsAsRead } from '../hooks/useMarkAllNotificationsAsRead'
import { usePopoverState } from '@components/ui/Popover'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'

interface NotificationHeaderProps {
  onClose?: () => void
  showClose?: boolean
}

/**
 * Simplified notification header.
 * Clean, minimal design with title and optional actions.
 */
export const NotificationHeader = ({ onClose, showClose = true }: NotificationHeaderProps) => {
  const popoverState = usePopoverState()
  const handleClose = onClose || popoverState.close
  const { handleMarkAllAsRead } = useMarkAllNotificationsAsRead()

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base-content text-lg font-semibold">Notifications</h2>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkAllAsRead}
          className="text-base-content/60 hover:text-primary hover:bg-primary/10 gap-1.5"
          aria-label="Mark all as read">
          <LuCheckCheck size={16} />
          <span className="text-xs font-medium">Mark all read</span>
        </Button>

        {showClose && <CloseButton onClick={handleClose} size="sm" />}
      </div>
    </div>
  )
}
