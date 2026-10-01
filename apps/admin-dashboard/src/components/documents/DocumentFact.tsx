import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

interface DocumentFactProps {
  icon: IconType
  label: string
  children: ReactNode
}

/**
 * One labelled fact in the delete dialogs. It sits on `base-200`, where `/60` ink is only 4.5:1.
 * The value wraps, not truncates, so a long value stays whole at phone width.
 */
export function DocumentFact({ icon: Icon, label, children }: DocumentFactProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="bg-base-300 rounded-field shrink-0 p-1.5">
        <Icon className="text-base-content/70 h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-base-content/70 text-meta">{label}</p>
        <p className="text-sm font-medium [overflow-wrap:anywhere]">{children}</p>
      </div>
    </div>
  )
}
