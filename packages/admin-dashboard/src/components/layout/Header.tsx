import { ReactNode } from 'react';
import { LuRefreshCw, LuDownload } from 'react-icons/lu';

interface HeaderProps {
  title: string;
  subtitle?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  onExport?: () => void;
  exportLabel?: string;
}

export function Header({
  title,
  subtitle,
  onRefresh,
  refreshing,
  onExport,
  exportLabel = 'Export CSV',
}: HeaderProps) {
  return (
    <header className="bg-base-100 border-b border-base-300 px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{title}</h1>
          {subtitle && (
            <div className="text-sm text-base-content/60 mt-1">{subtitle}</div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onExport && (
            <button
              onClick={onExport}
              className="btn btn-outline btn-sm gap-2"
            >
              <LuDownload className="h-4 w-4" />
              <span className="hidden sm:inline">{exportLabel}</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="btn btn-ghost btn-sm gap-2"
            >
              <LuRefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
