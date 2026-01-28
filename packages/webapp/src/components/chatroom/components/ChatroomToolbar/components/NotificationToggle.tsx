import { LuBell, LuBellOff, LuAtSign } from 'react-icons/lu'
import Button from '@components/ui/Button'
import { useNotificationToggle } from '@components/chatroom/hooks/useNotificationToggle'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

const notificationConfig = {
  ALL: {
    icon: LuBell,
    label: 'All notifications'
  },
  MENTIONS: {
    icon: LuAtSign,
    label: 'Mentions only'
  },
  MUTED: {
    icon: LuBellOff,
    label: 'Muted'
  }
}

export const NotificationToggle = ({ className }: Props) => {
  const { notificationState, loading, handleToggle } = useNotificationToggle()

  const config = notificationConfig[notificationState]
  const Icon = config.icon

  return (
    <div className="tooltip tooltip-bottom" data-tip={config.label}>
      <Button
        variant="ghost"
        size="xs"
        shape="square"
        loading={loading}
        onClick={handleToggle}
        className={twMerge('hover:bg-base-300', className)}
        aria-label={`Notifications: ${config.label}`}>
        <Icon size={16} />
      </Button>
    </div>
  )
}
