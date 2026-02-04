import { LuApple, LuChrome, LuMail, LuSmartphone } from 'react-icons/lu'

export interface NotificationBadgesProps {
  web?: boolean
  ios?: boolean
  android?: boolean
  email?: boolean
}

// Single badge with tooltip
function Badge({
  active,
  icon: Icon,
  label,
  activeColor
}: {
  active: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
  activeColor: string
}) {
  return (
    <div className="tooltip tooltip-top" data-tip={active ? `${label} enabled` : `${label} off`}>
      <div
        className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
          active ? `${activeColor} text-white` : 'bg-base-200 text-base-content/30'
        }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

/**
 * Compact notification subscription badges
 * Shows which notification channels a user has enabled
 */
export function NotificationBadges({ web, ios, android, email }: NotificationBadgesProps) {
  const hasAny = web || ios || android || email

  if (!hasAny) {
    return <span className="text-base-content/40 text-xs">None</span>
  }

  return (
    <div className="flex items-center gap-1">
      <Badge active={!!web} icon={LuChrome} label="Web Push" activeColor="bg-primary" />
      <Badge active={!!ios} icon={LuApple} label="iOS Push" activeColor="bg-secondary" />
      <Badge active={!!android} icon={LuSmartphone} label="Android Push" activeColor="bg-accent" />
      <Badge active={!!email} icon={LuMail} label="Email" activeColor="bg-info" />
    </div>
  )
}
