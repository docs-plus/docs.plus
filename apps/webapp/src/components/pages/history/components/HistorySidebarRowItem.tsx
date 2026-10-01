import { ListGroupLabel } from '@components/ui/ListGroupLabel'
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
  onSelectVersion,
  comparePick
}: HistorySidebarRowItemProps) {
  switch (row.kind) {
    case 'day-header':
      return (
        <div className="border-base-300 border-b">
          <button
            type="button"
            onClick={() => onToggleDay(row.dayKey)}
            className="bg-base-200 hover:bg-base-300 focus-visible:ring-primary flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset">
            <ListGroupLabel as="span">{row.label}</ListGroupLabel>
            {openDays.has(row.dayKey) ? (
              <Icons.chevronUp className="text-base-content/50 shrink-0" size={16} />
            ) : (
              <Icons.chevronDown className="text-base-content/50 shrink-0" size={16} />
            )}
          </button>
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
            comparePick={comparePick}
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
            comparePick={comparePick}
          />
        </div>
      )

    default: {
      const _exhaustive: never = row
      return _exhaustive
    }
  }
}
