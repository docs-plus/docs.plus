import { ReactNode } from 'react'
import { IconType } from 'react-icons'

import CloseButton from './CloseButton'

export type PanelHeaderVariant = 'default' | 'primary' | 'info' | 'warning' | 'error' | 'success'

interface PanelHeaderProps {
  /** The icon component to display */
  icon?: IconType
  /** Main title text */
  title: string
  /** Optional description text below title */
  description?: string
  /** Color variant for the icon background */
  variant?: PanelHeaderVariant
  /** Called when close button is clicked. If omitted, no close button is shown. */
  onClose?: () => void
  /** Additional content to render after the close button */
  actions?: ReactNode
  /** Additional className for the container */
  className?: string
}

// Design system compliant color tokens
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

/**
 * A consistent header component for dialogs, popovers, and panels.
 * Includes icon, title, optional description, and optional close button.
 *
 * @example
 * // Basic usage with close button
 * <PanelHeader
 *   icon={LuSettings}
 *   title="Settings"
 *   description="Document settings and preferences"
 *   onClose={handleClose}
 * />
 *
 * // With color variant
 * <PanelHeader
 *   icon={LuBell}
 *   title="Notifications"
 *   variant="info"
 *   onClose={handleClose}
 * />
 *
 * // Minimal - just title and close
 * <PanelHeader
 *   title="Notifications"
 *   onClose={handleClose}
 * />
 */
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
