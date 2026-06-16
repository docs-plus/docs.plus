import Button from '@components/ui/Button'
import { Icons } from '@icons'

import type { HistorySidebarRowHandlers, SidebarRow } from '../types'
import { HistorySessionRow } from './HistorySessionRow'
import { HistorySingleVersionRow } from './HistorySingleVersionRow'

type HistorySidebarRowItemProps = HistorySidebarRowHandlers & { row: SidebarRow }

export function HistorySidebarRowItem({
  row,
  activeVersion,
  latestVersion,
  openDays,
  onToggleDay,
  onToggleSession,
  onSelectVersion
}: HistorySidebarRowItemProps) {
  switch (row.kind) {
    case 'day-header':
      return (
        <div className="border-base-300 border-b">
          <Button
            onClick={() => onToggleDay(row.dayKey)}
            variant="ghost"
            className="btn-block bg-base-200 hover:bg-base-300/80 active:bg-base-300/80 justify-between rounded-none border-0 px-3 py-2 shadow-none">
            <span className="text-base-content text-xs font-semibold tracking-wide uppercase">
              {row.label}
            </span>
            {openDays.has(row.dayKey) ? (
              <Icons.chevronUp className="text-base-content/50 shrink-0" size={16} />
            ) : (
              <Icons.chevronDown className="text-base-content/50 shrink-0" size={16} />
            )}
          </Button>
        </div>
      )

    case 'single-version':
      return (
        <div className="px-3 py-1">
          <HistorySingleVersionRow
            version={row.version}
            activeVersion={activeVersion}
            latestVersion={latestVersion}
            onSelectVersion={onSelectVersion}
          />
        </div>
      )

    case 'session':
      return (
        <div className="px-3 py-1">
          <HistorySessionRow
            session={row.session}
            expanded={row.expanded}
            activeVersion={activeVersion}
            latestVersion={latestVersion}
            onToggleSession={onToggleSession}
            onSelectVersion={onSelectVersion}
          />
        </div>
      )

    default: {
      const _exhaustive: never = row
      return _exhaustive
    }
  }
}
