/**
 * ActionCard Component
 * =====================
 * A clickable card for quick actions with icon and description.
 */

import { MdOpenInNew } from 'react-icons/md'

interface ActionCardProps {
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor: string
  bgColor: string
  delay?: number
}

export const ActionCard = ({
  label,
  description,
  icon: Icon,
  iconColor,
  bgColor,
  delay = 0
}: ActionCardProps) => (
  <button
    className={`group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:scale-[1.02] hover:shadow-md ${bgColor}`}
    style={{ animationDelay: `${delay}ms` }}>
    <div className="bg-base-100 flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform group-hover:scale-110">
      <Icon size={20} className={iconColor} aria-hidden="true" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-base-content text-sm font-medium">{label}</p>
      <p className="text-base-content/60 text-xs">{description}</p>
    </div>
    <MdOpenInNew
      size={16}
      className="text-base-content/40 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
      aria-hidden="true"
    />
  </button>
)
