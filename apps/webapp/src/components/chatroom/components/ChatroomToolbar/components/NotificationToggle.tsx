import { useNotificationToggle } from '@components/chatroom/hooks/useNotificationToggle'
import Button from '@components/ui/Button'
import { ButtonSize } from '@components/ui/Button'
import { Icons } from '@icons'
import { useAuthStore } from '@stores'
import { twMerge } from '@utils/twMerge'

import { chatToolbarIconButtonClassName } from './ShareButton'

type Props = {
  className?: string
  size?: ButtonSize
  iconSize?: number
}

const notificationStates = ['ALL', 'MENTIONS', 'MUTED'] as const

// The square button's box per size, so the first-read bone matches its toolbar neighbours.
const BONE_SIZE: Record<ButtonSize, string> = {
  xs: 'size-6',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
  xl: 'size-14'
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

export const NotificationToggle = ({ className, size = 'sm', iconSize }: Props) => {
  // Anon viewers can't subscribe/mute notifications — there's no
  // channel_members row for them. Hide the toggle entirely rather than
  // showing a button that 401s on click.
  const profile = useAuthStore((state) => state.profile)
  const { notificationState, loading, fetchLoading, handleToggle } = useNotificationToggle()

  if (!profile?.id) return null

  if (fetchLoading) {
    return (
      <div
        className={twMerge('skeleton rounded-field shrink-0', BONE_SIZE[size], className)}
        aria-hidden
      />
    )
  }

  const config = notificationConfig[notificationState]
  const resolvedIconSize = iconSize ?? (size === 'xs' ? 14 : 16)

  return (
    <Button
      variant="ghost"
      size={size}
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
              size={resolvedIconSize}
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
