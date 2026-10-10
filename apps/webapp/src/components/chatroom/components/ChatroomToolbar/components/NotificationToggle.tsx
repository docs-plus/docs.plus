import { useNotificationToggle } from '@components/chatroom/hooks/useNotificationToggle'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { twMerge } from '@utils/twMerge'

import { chatToolbarIconButtonClassName } from './ShareButton'

type Props = {
  className?: string
  iconSize?: number
}

const notificationStates = ['ALL', 'MENTIONS', 'MUTED'] as const

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

export const NotificationToggle = ({ className, iconSize = 16 }: Props) => {
  // Anon viewers can't subscribe/mute notifications — there's no
  // channel_members row for them. Hide the toggle entirely rather than
  // showing a button that 401s on click.
  const profile = useAuthStore((state) => state.profile)
  const { notificationState, loading, fetchLoading, handleToggle } = useNotificationToggle()

  if (!profile?.id) return null

  if (fetchLoading) {
    return (
      <div
        // The `btn-sm` square box, so the bone matches its toolbar neighbours.
        className={twMerge('skeleton rounded-field size-8 shrink-0', className)}
        aria-hidden
      />
    )
  }

  const config = notificationConfig[notificationState]

  return (
    <Button
      variant="ghost"
      size="sm"
      shape="square"
      disabled={loading}
      onClick={handleToggle}
      tooltip={config.label}
      className={twMerge(chatToolbarIconButtonClassName, className)}
      aria-label={`Notifications: ${config.label}`}>
      <span className="inline-grid place-content-center" aria-hidden>
        {notificationStates.map((state) => {
          const StateIcon = notificationConfig[state].icon
          return (
            <StateIcon
              key={state}
              size={iconSize}
              className={twMerge(
                'col-start-1 row-start-1 stroke-[1.75] motion-safe:transition-opacity motion-safe:duration-[var(--motion-panel)] motion-safe:ease-[var(--motion-ease-enter)]',
                notificationState === state ? 'opacity-100' : 'opacity-0'
              )}
            />
          )
        })}
      </span>
    </Button>
  )
}
