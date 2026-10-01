import Button from '@components/ui/Button'
import { LuCheckCheck } from 'react-icons/lu'

import { useMarkAllNotificationsAsRead } from '../hooks/useMarkAllNotificationsAsRead'

export function NotificationMarkAllReadButton() {
  const { handleMarkAllAsRead } = useMarkAllNotificationsAsRead()

  return (
    <Button
      variant="quiet"
      startIcon={<LuCheckCheck size={14} aria-hidden />}
      onClick={handleMarkAllAsRead}>
      Mark all read
    </Button>
  )
}
