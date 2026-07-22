import { formatCappedCount } from '@utils/formatCappedCount'
import { twMerge } from 'tailwind-merge'

export interface RollingNumberProps {
  value: number
  max?: number
  className?: string
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

function clampDigit(digit: number): number {
  if (!Number.isFinite(digit)) return 0
  return ((Math.trunc(digit) % 10) + 10) % 10
}

/** One 0–9 reel. Em-sized cells + overflow:hidden — Safari-safe vs daisyUI `.countdown`. */
const DigitReel = ({ digit }: { digit: number }) => {
  const d = clampDigit(digit)
  return (
    <span className="inline-block h-[1em] w-[1ch] overflow-hidden leading-none">
      <span
        className="flex flex-col motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
        style={{ transform: `translate3d(0, ${-d}em, 0)` }}>
        {DIGITS.map((n) => (
          <span
            key={n}
            className="flex h-[1em] w-[1ch] shrink-0 items-center justify-center leading-none">
            {n}
          </span>
        ))}
      </span>
    </span>
  )
}

/** Rolling-digit display; visual-only (no aria-live — host owns a11y). */
const RollingNumber = ({ value, max = 99, className }: RollingNumberProps) => {
  if (value <= 0) return null

  if (value > max) {
    return (
      <span className={twMerge('tabular-nums', className)}>{formatCappedCount(value, max)}</span>
    )
  }

  const n = Math.trunc(value)
  const tens = Math.floor(n / 10)
  const ones = n % 10

  return (
    <span
      className={twMerge('inline-flex h-[1em] items-center leading-none tabular-nums', className)}>
      {n >= 10 ? <DigitReel digit={tens} /> : null}
      <DigitReel digit={ones} />
    </span>
  )
}

export default RollingNumber
