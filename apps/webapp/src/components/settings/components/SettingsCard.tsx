import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

interface SettingsCardProps {
  children: React.ReactNode
  className?: string
}

const SettingsCard = ({ children, className }: SettingsCardProps) => (
  <section
    className={twMerge('bg-base-100 border-base-300 rounded-box border p-4 sm:p-6', className)}>
    {children}
  </section>
)

interface SettingsCardHeaderProps {
  icon: IconType
  title: ReactNode
  description?: ReactNode
  /** Trailing items on the title row, such as a status or a quiet link. */
  children?: ReactNode
  className?: string
}

/** The one section card header. */
export const SettingsCardHeader = ({
  icon: Icon,
  title,
  description,
  children,
  className
}: SettingsCardHeaderProps) => (
  <div className={twMerge('mb-3 flex flex-col gap-1', className)}>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Icon size={20} aria-hidden className="text-primary shrink-0" />
      <h3 className="text-base-content text-base font-semibold">{title}</h3>
      {children}
    </div>
    {description ? <p className="text-meta text-base-content/60">{description}</p> : null}
  </div>
)

export default SettingsCard
