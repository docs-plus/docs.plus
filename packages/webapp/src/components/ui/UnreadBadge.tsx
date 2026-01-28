import { twMerge } from 'tailwind-merge'

export type UnreadBadgeSize = 'xs' | 'sm' | 'md' | 'lg'
export type UnreadBadgeVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral'

export interface UnreadBadgeProps {
  /** The count to display */
  count: number
  /** Maximum count before showing "99+" */
  max?: number
  /** Size of the badge */
  size?: UnreadBadgeSize
  /** Color variant */
  variant?: UnreadBadgeVariant
  /** Additional className */
  className?: string
}

// Size classes
const sizeClasses: Record<UnreadBadgeSize, string> = {
  xs: 'text-[10px] min-w-4 h-4 px-1',
  sm: 'text-xs min-w-5 h-5 px-1.5',
  md: 'text-xs min-w-6 h-6 px-2',
  lg: 'text-sm min-w-7 h-7 px-2'
}

// Variant classes
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

/**
 * Animated unread count badge using daisyUI countdown for smooth sliding transitions.
 * Works for both count up and count down - the CSS transition animates automatically.
 */
const UnreadBadge = ({
  count,
  max = 99,
  size = 'sm',
  variant = 'primary',
  className
}: UnreadBadgeProps) => {
  if (count === 0) return null

  const isOverMax = count > max
  const displayCount = isOverMax ? max : count

  return (
    <span
      className={twMerge(
        'badge inline-flex items-center justify-center rounded-full font-semibold tabular-nums',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      aria-live="polite"
      aria-label={`${count} unread`}>
      <span className="countdown">
        <span style={{ '--value': displayCount } as React.CSSProperties}>{displayCount}</span>
      </span>
      {isOverMax && '+'}
    </span>
  )
}

export default UnreadBadge
