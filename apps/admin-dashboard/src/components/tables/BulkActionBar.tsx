import type { ReactNode } from 'react'
import { LuX } from 'react-icons/lu'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  children: ReactNode
}

export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div className="bg-primary/10 border-primary/20 rounded-box flex items-center gap-4 border p-3">
      <span className="text-base-content text-sm font-medium">
        {count} item{count !== 1 ? 's' : ''} selected
      </span>

      <div className="flex gap-2">{children}</div>

      <button
        type="button"
        onClick={onClear}
        className="btn btn-ghost btn-sm ml-auto gap-1"
        title="Clear selection">
        <LuX className="h-4 w-4" aria-hidden />
        Clear
      </button>
    </div>
  )
}
