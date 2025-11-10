import { IoNotifications, IoNotificationsOff } from 'react-icons/io5'
import { RiAtLine } from 'react-icons/ri'
import Button from '@components/ui/Button'
import { useNotificationToggle } from '@components/chatroom/hooks/useNotificationToggle'

type Props = {
  className?: string
}

export const NotificationToggle = ({ className }: Props) => {
  const { notificationState, loading, handleToggle } = useNotificationToggle()

  const notificationIcons = {
    ALL: <IoNotifications size={18} />,
    MENTIONS: <RiAtLine size={18} />,
    MUTED: <IoNotificationsOff size={18} />
  }
  return (
    <Button
      loading={loading}
      onClick={handleToggle}
      className={`btn btn-sm btn-square btn-ghost tooltip tooltip-left flex items-center ${className} `}
      data-tip={`Notifications: ${notificationState}`}>
      {notificationIcons[notificationState]}
    </Button>
  )
}
