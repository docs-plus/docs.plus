import { twMerge } from '@utils/twMerge'

import { FieldHelp } from './FieldHelp'
import { TextLine } from './TextLine'

interface ToggleRowSkeletonProps {
  /** Text known before the read stays real; a missing one becomes a bone. */
  label?: string
  description?: string
  className?: string
}

/**
 * Mirrors `ui/ToggleRow`. Its inline label sits on the parent's 24px strut, so the label box
 * is `h-6`; the help line is 20px. The switch bone is the measured `toggle-sm`, 40x24.
 */
export function ToggleRowSkeleton({ label, description, className }: ToggleRowSkeletonProps) {
  return (
    <div className={twMerge('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        {label ? (
          <span className="text-base-content text-sm font-medium">{label}</span>
        ) : (
          <TextLine box="h-6" bone="h-3.5 w-24" />
        )}
        {description ? (
          <FieldHelp>{description}</FieldHelp>
        ) : (
          <TextLine bone="h-3 w-48 max-w-full" />
        )}
      </div>
      <div className="skeleton h-6 w-10 shrink-0 rounded-full" aria-hidden />
    </div>
  )
}
