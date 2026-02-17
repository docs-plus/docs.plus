import { useNotificationToggle } from '@components/chatroom/hooks/useNotificationToggle'
import Button from '@components/ui/Button'
import { ButtonSize } from '@components/ui/Button'
import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
  size?: ButtonSize
}

const notificationConfig = {
  ALL: {
    icon: Icons.notifications,
    label: 'All notifications'
  },
  MENTIONS: {
    icon: Icons.mention,
    label: 'Mentions only'
  },
  MUTED: {
    icon: Icons.notificationsOff,
    label: 'Muted'
  }
}

export const NotificationToggle = ({ className, size = 'sm' }: Props) => {
  const { notificationState, loading, handleToggle } = useNotificationToggle()

  const config = notificationConfig[notificationState]
  const Icon = config.icon

  return (
    <Button
      variant="ghost"
      size={size}
      shape="square"
      loading={loading}
      onClick={handleToggle}
      title={config.label}
      className={twMerge(
        'text-base-content/60 hover:text-base-content hover:bg-base-300 focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none',
        className
      )}
      aria-label={`Notifications: ${config.label}`}>
      <Icon size={size === 'xs' ? 14 : 16} />
    </Button>
  )
}
