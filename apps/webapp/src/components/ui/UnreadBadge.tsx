import { twMerge } from 'tailwind-merge'

import RollingNumber from './RollingNumber'

export type UnreadBadgeSize = 'xs' | 'sm' | 'md' | 'lg'
export type UnreadBadgeVariant =
  'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'neutral'

export interface UnreadBadgeProps {
  count: number
  max?: number
  size?: UnreadBadgeSize
  variant?: UnreadBadgeVariant
  className?: string
}

const sizeClasses: Record<UnreadBadgeSize, string> = {
  xs: 'text-[10px] min-w-4 h-4 px-1',
  sm: 'text-xs min-w-5 h-5 px-1.5',
  md: 'text-xs min-w-6 h-6 px-2',
  lg: 'text-sm min-w-7 h-7 px-2'
}

const variantClasses: Record<UnreadBadgeVariant, string> = {
  primary: 'bg-primary text-primary-content',
  secondary: 'bg-secondary text-secondary-content',
  accent: 'bg-accent text-accent-content',
  info: 'bg-info text-info-content',
  success: 'bg-success text-success-content',
  warning: 'bg-warning text-warning-content',
  error: 'bg-error text-error-content',
  neutral: 'bg-neutral text-neutral-content'
}

const UnreadBadge = ({
  count,
  max = 99,
  size = 'sm',
  variant = 'primary',
  className
}: UnreadBadgeProps) => {
  if (count <= 0) return null

  return (
    <span
      className={twMerge(
        // Mount-scoped entry: count <= 0 unmounts, so it replays on each 0→N transition.
        'badge animate-badge-entry inline-flex items-center justify-center rounded-full leading-none font-semibold',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${count} unread`}>
      <RollingNumber value={count} max={max} />
    </span>
  )
}

export default UnreadBadge
