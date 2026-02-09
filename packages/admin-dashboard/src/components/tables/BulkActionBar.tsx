import type { ReactNode } from 'react'
import { LuX } from 'react-icons/lu'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  children: ReactNode // Action buttons
}

/**
 * Floating bar that appears when items are selected for bulk actions
 * Displays selection count and action buttons
 */
export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div className="bg-primary/10 border-primary/20 flex items-center gap-4 rounded-lg border p-3">
      <span className="text-primary text-sm font-medium">
        {count} item{count !== 1 ? 's' : ''} selected
      </span>

      <div className="flex gap-2">{children}</div>

      <button
        onClick={onClear}
        className="btn btn-ghost btn-sm ml-auto gap-1"
        title="Clear selection">
        <LuX className="h-4 w-4" />
        Clear
      </button>
    </div>
  )
}
