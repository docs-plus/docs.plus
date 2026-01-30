import { ReactNode } from 'react'
import { LuDownload,LuRefreshCw } from 'react-icons/lu'

interface HeaderProps {
  title: string
  subtitle?: ReactNode
  onRefresh?: () => void
  refreshing?: boolean
  onExport?: () => void
  exportLabel?: string
}

export function Header({
  title,
  subtitle,
  onRefresh,
  refreshing,
  onExport,
  exportLabel = 'Export CSV'
}: HeaderProps) {
  return (
    <header className="bg-base-100 border-base-300 border-b px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">{title}</h1>
          {subtitle && <div className="text-base-content/60 mt-1 text-sm">{subtitle}</div>}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {onExport && (
            <button onClick={onExport} className="btn btn-outline btn-sm gap-2">
              <LuDownload className="h-4 w-4" />
              <span className="hidden sm:inline">{exportLabel}</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="btn btn-ghost btn-sm gap-2">
              <LuRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
