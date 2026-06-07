import { formatCappedCount } from '@utils/formatCappedCount'
import type { CSSProperties } from 'react'
import { twMerge } from 'tailwind-merge'

export interface RollingNumberProps {
  value: number
  max?: number
  className?: string
}

/** Rolling-digit display via daisyUI `.countdown`; visual-only (no aria-live). */
const RollingNumber = ({ value, max = 99, className }: RollingNumberProps) => {
  if (value <= 0) return null

  if (value > max) {
    return (
      <span className={twMerge('tabular-nums', className)}>{formatCappedCount(value, max)}</span>
    )
  }

  return (
    <span className={twMerge('countdown tabular-nums', className)}>
      <span style={{ '--value': value } as CSSProperties}>{value}</span>
    </span>
  )
}

export default RollingNumber
