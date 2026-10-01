import { LuApple, LuChrome, LuMail, LuSmartphone } from 'react-icons/lu'

export interface NotificationBadgesProps {
  web?: boolean
  ios?: boolean
  android?: boolean
  email?: boolean
}

function Badge({
  active,
  icon: Icon,
  label,
  activeTone
}: {
  active: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
  /** Fill plus its paired `-content` ink; raw white fails 3:1 on the accent fill. */
  activeTone: string
}) {
  const tip = active ? `${label} enabled` : `${label} off`
  return (
    <div className="tooltip tooltip-top" data-tip={tip}>
      <div
        role="img"
        aria-label={tip}
        className={`rounded-field flex h-6 w-6 items-center justify-center transition-colors ${
          active ? activeTone : 'bg-base-200 text-base-content/40'
        }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

export function NotificationBadges({ web, ios, android, email }: NotificationBadgesProps) {
  const hasAny = web || ios || android || email

  if (!hasAny) {
    return <span className="text-base-content/60 text-xs">None</span>
  }

  return (
    <div className="flex items-center gap-1">
      <Badge
        active={!!web}
        icon={LuChrome}
        label="Web Push"
        activeTone="bg-primary text-primary-content"
      />
      <Badge
        active={!!ios}
        icon={LuApple}
        label="iOS Push"
        activeTone="bg-secondary text-secondary-content"
      />
      <Badge
        active={!!android}
        icon={LuSmartphone}
        label="Android Push"
        activeTone="bg-accent text-accent-content"
      />
      <Badge active={!!email} icon={LuMail} label="Email" activeTone="bg-info text-info-content" />
    </div>
  )
}
