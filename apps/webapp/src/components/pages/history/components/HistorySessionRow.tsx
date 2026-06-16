import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { formatRelativeTime, formatTime, sessionContainsVersion } from '../helpers'
import type { VersionSession } from '../types'
import {
  CopyVersionLinkButton,
  HistoryLatestBadge,
  HistoryTimelineDot
} from './HistorySidebarRowParts'

export function HistorySessionRow({
  session,
  expanded,
  activeVersion,
  latestVersion,
  onToggleSession,
  onSelectVersion
}: {
  session: VersionSession
  expanded: boolean
  activeVersion: number
  latestVersion: number
  onToggleSession: (sessionId: string) => void
  onSelectVersion: (version: number) => void
}) {
  const isActive = sessionContainsVersion(session, activeVersion)
  const isLatestSession = session.isLatest

  return (
    <div
      className={twMerge(
        'rounded-box overflow-hidden border transition-colors duration-150',
        isActive
          ? 'border-primary/50 bg-base-100'
          : 'border-base-300 bg-base-100 hover:border-base-content/20'
      )}
      data-testid={`history-session-row-${session.id}`}>
      <Button
        onClick={() => onToggleSession(session.id)}
        variant="ghost"
        className="btn-block hover:bg-base-200/50 active:bg-base-200/50 h-auto min-h-11 items-center justify-start gap-2.5 rounded-none border-0 px-3 py-2.5 text-left shadow-none">
        <span
          className={twMerge(
            'badge badge-sm shrink-0 tabular-nums',
            isActive ? 'badge-primary' : 'badge-ghost border-base-300 border'
          )}>
          {session.versions.length}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={twMerge(
                'text-sm font-medium',
                isActive ? 'text-primary' : 'text-base-content/90'
              )}>
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </span>
            {isLatestSession && <HistoryLatestBadge />}
          </div>
          <p
            className={twMerge(
              'text-base-content/50 mt-0.5 text-xs',
              isActive && 'text-primary/70'
            )}>
            {session.versions.length} changes · {formatRelativeTime(session.endTime)}
          </p>
        </div>

        {expanded ? (
          <Icons.chevronUp className="text-base-content/50 shrink-0" size={16} />
        ) : (
          <Icons.chevronDown className="text-base-content/50 shrink-0" size={16} />
        )}
      </Button>

      {expanded && (
        <div className="px-2 pb-2">
          <div className="border-base-300 mx-1 border-t" aria-hidden />
          <ul
            className="mt-1 list-none space-y-0.5 p-0"
            role="list"
            aria-label={`${session.versions.length} revisions in this session`}>
            {session.versions.map((version) => {
              const isCurrentActive = version.version === activeVersion
              const isLatest = version.version === latestVersion

              return (
                <li
                  key={version.version}
                  className={twMerge(
                    'group rounded-field flex min-h-10 items-stretch overflow-hidden transition-colors duration-150',
                    isCurrentActive ? 'bg-primary/10' : 'hover:bg-base-200/70'
                  )}
                  data-testid={`history-version-row-${version.version}`}>
                  <Button
                    onClick={() => onSelectVersion(version.version)}
                    variant="ghost"
                    size="sm"
                    className="h-auto min-h-10 min-w-0 flex-1 items-center justify-start gap-2 rounded-none border-0 px-2.5 py-2 text-left shadow-none hover:bg-transparent active:bg-transparent">
                    <HistoryTimelineDot active={isCurrentActive} className="size-1.5 shrink-0" />
                    <span
                      className={twMerge(
                        'text-sm font-medium',
                        isCurrentActive ? 'text-primary' : 'text-base-content/85'
                      )}>
                      {formatTime(version.createdAt)}
                    </span>
                    {isLatest && !isLatestSession && <HistoryLatestBadge compact />}
                  </Button>
                  <CopyVersionLinkButton
                    version={version.version}
                    isActiveRow={isCurrentActive}
                    inlineInRow
                  />
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
