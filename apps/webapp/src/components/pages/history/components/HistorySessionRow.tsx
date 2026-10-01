import { Icons } from '@icons'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { useMemo } from 'react'

import { formatRelativeTime, formatTime, sessionContainsVersion } from '../helpers'
import type { VersionSession } from '../types'
import {
  CompareBaseMarker,
  CopyVersionLinkButton,
  HistoryLatestBadge,
  HistoryTimelineDot,
  PeopleAttribution,
  peopleFromHistoryItems,
  VersionAttribution,
  VersionTriggerBadge
} from './HistorySidebarRowParts'

export function HistorySessionRow({
  session,
  expanded,
  activeVersion,
  latestVersion,
  onToggleSession,
  onSelectVersion,
  comparePick = false
}: {
  session: VersionSession
  expanded: boolean
  activeVersion: number
  latestVersion: number
  onToggleSession: (sessionId: string) => void
  onSelectVersion: (version: number) => void
  comparePick?: boolean
}) {
  const isActive = sessionContainsVersion(session, activeVersion)
  const isLatestSession = session.isLatest
  const profiles = useStore((state) => state.profiles)
  const people = useMemo(
    () => peopleFromHistoryItems(session.versions, profiles),
    [session.versions, profiles]
  )

  return (
    <div
      className={twMerge(
        'rounded-box overflow-hidden border transition-colors duration-150',
        isActive
          ? 'border-primary/50 bg-base-100'
          : 'border-base-300 bg-base-100 hover:border-base-content/20'
      )}
      data-testid={`history-session-row-${session.id}`}>
      {/* Plain buttons with inset rings: the card clips overflow, so a btn outline would not show. */}
      <button
        type="button"
        onClick={() => onToggleSession(session.id)}
        className={twMerge(
          'hover:bg-base-200 focus-visible:ring-primary flex min-h-11 w-full cursor-pointer items-center justify-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
          expanded ? 'rounded-t-box' : 'rounded-box'
        )}>
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
                isActive ? 'text-[var(--primary-ink)]' : 'text-base-content'
              )}>
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </span>
            {isLatestSession && <HistoryLatestBadge />}
          </div>
          <p className="text-base-content/60 mt-0.5 text-xs">
            {formatRelativeTime(session.endTime)}
          </p>
        </div>

        <PeopleAttribution people={people} inline showName={false} />

        {expanded ? (
          <Icons.chevronUp className="text-base-content/50 shrink-0" size={16} />
        ) : (
          <Icons.chevronDown className="text-base-content/50 shrink-0" size={16} />
        )}
      </button>

      {expanded && (
        <div className="px-2 pb-2">
          <div className="border-base-300 mx-1 border-t" aria-hidden />
          <ul
            className="mt-1 list-none space-y-0.5 p-0"
            role="list"
            aria-label={`${session.versions.length} versions in this session`}>
            {session.versions.map((version) => {
              const isCurrentActive = version.version === activeVersion
              const isLatest = version.version === latestVersion
              const pickBlocked = comparePick && isCurrentActive

              return (
                <li
                  key={version.version}
                  className={twMerge(
                    'group rounded-field flex min-h-10 items-stretch overflow-hidden transition-colors duration-150',
                    isCurrentActive ? 'bg-primary/10' : 'hover:bg-base-200'
                  )}
                  data-testid={`history-version-row-${version.version}`}>
                  <button
                    type="button"
                    onClick={() => onSelectVersion(version.version)}
                    disabled={pickBlocked}
                    aria-label={pickBlocked ? 'This is the version you are viewing' : undefined}
                    className="rounded-field focus-visible:ring-primary flex min-h-10 min-w-0 flex-1 cursor-pointer items-center justify-start gap-2 px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-40">
                    <HistoryTimelineDot active={isCurrentActive} className="size-1.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={twMerge(
                            'text-sm font-medium',
                            isCurrentActive ? 'text-[var(--primary-ink)]' : 'text-base-content'
                          )}>
                          {formatTime(version.createdAt)}
                        </span>
                        {isLatest && !isLatestSession && <HistoryLatestBadge compact />}
                        {/* Trailing group: one line, so the badge and faces share an
                            anchor instead of doubling the height of the majority row. */}
                        <span className="ml-auto flex min-w-0 shrink items-center gap-1.5">
                          <CompareBaseMarker version={version.version} />
                          <VersionTriggerBadge trigger={version.trigger} />
                          <VersionAttribution item={version} inline />
                        </span>
                      </span>
                      {/* A restore always mints its two rows seconds apart, so they always
                          group here — this is the only place their names can be read.
                          Autosaves carry an empty message, so row density is untouched. */}
                      {version.commitMessage && (
                        <span className="text-base-content/70 mt-0.5 block truncate text-xs">
                          {version.commitMessage}
                        </span>
                      )}
                    </span>
                  </button>
                  {!comparePick && (
                    <CopyVersionLinkButton
                      version={version.version}
                      createdAt={version.createdAt}
                      isActiveRow={isCurrentActive}
                      className="rounded-field"
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
