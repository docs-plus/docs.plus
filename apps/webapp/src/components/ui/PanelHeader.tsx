import { ReactNode } from 'react'
import { IconType } from 'react-icons'

import CloseButton from './CloseButton'

export type PanelHeaderVariant = 'default' | 'primary' | 'info' | 'warning' | 'error' | 'success'

interface PanelHeaderProps {
  icon?: IconType
  title: string
  description?: string
  variant?: PanelHeaderVariant
  /** Omit to hide the close button. */
  onClose?: () => void
  actions?: ReactNode
  className?: string
}

const VARIANT_STYLES = {
  default: {
    bg: 'bg-base-200',
    icon: 'text-base-content'
  },
  primary: {
    bg: 'bg-primary/10',
    icon: 'text-primary'
  },
  info: {
    bg: 'bg-info/10',
    icon: 'text-info'
  },
  warning: {
    bg: 'bg-warning/10',
    icon: 'text-warning'
  },
  error: {
    bg: 'bg-error/10',
    icon: 'text-error'
  },
  success: {
    bg: 'bg-success/10',
    icon: 'text-success'
  }
} as const

const PanelHeader = ({
  icon: Icon,
  title,
  description,
  variant = 'default',
  onClose,
  actions,
  className = ''
}: PanelHeaderProps) => {
  const styles = VARIANT_STYLES[variant]

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${styles.bg}`}>
            <Icon className={`size-5 ${styles.icon}`} />
          </div>
        )}
        <div>
          <h2 className="text-base-content text-lg font-bold">{title}</h2>
          {description && <p className="text-base-content/60 text-sm">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {actions}
        {onClose && <CloseButton onClick={onClose} />}
      </div>
    </div>
  )
}

PanelHeader.displayName = 'PanelHeader'

export default PanelHeader
