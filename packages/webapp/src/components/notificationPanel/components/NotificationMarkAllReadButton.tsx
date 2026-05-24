import Button from '@components/ui/Button'
import { LuCheckCheck } from 'react-icons/lu'

import { useMarkAllNotificationsAsRead } from '../hooks/useMarkAllNotificationsAsRead'

export function NotificationMarkAllReadButton() {
  const { handleMarkAllAsRead } = useMarkAllNotificationsAsRead()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleMarkAllAsRead}
      className="text-base-content/60 hover:text-primary hover:bg-primary/10 gap-1.5"
      aria-label="Mark all as read">
      <LuCheckCheck size={16} />
      <span className="text-xs font-medium">Mark all read</span>
    </Button>
  )
}
