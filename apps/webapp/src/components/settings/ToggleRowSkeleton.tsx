import { FieldHelp } from '@components/ui/FieldHelp'
import { twMerge } from '@utils/twMerge'

interface ToggleRowSkeletonProps {
  /** Text known before the read stays real; a missing one becomes a bone. */
  label?: string
  description?: string
  className?: string
}

/**
 * Mirrors `ui/ToggleRow`. Its inline label sits on the parent's 24px strut, so the label box
 * is `h-6`; the help line is 20px. The switch bone is the measured `toggle-sm`, 40x24.
 * Only the bones are `aria-hidden`, so real text stays readable while the state loads.
 */
export function ToggleRowSkeleton({ label, description, className }: ToggleRowSkeletonProps) {
  return (
    <div className={twMerge('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        {label ? (
          <span className="text-base-content text-sm font-medium">{label}</span>
        ) : (
          <div className="flex h-6 items-center" aria-hidden>
            <div className="skeleton h-3.5 w-24" />
          </div>
        )}
        {description ? (
          <FieldHelp>{description}</FieldHelp>
        ) : (
          <div className="flex h-5 items-center" aria-hidden>
            <div className="skeleton h-3 w-48 max-w-full" />
          </div>
        )}
      </div>
      <div className="skeleton h-6 w-10 shrink-0 rounded-full" aria-hidden />
    </div>
  )
}
