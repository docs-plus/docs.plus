import {
  copyHistoryVersionLinkToClipboard,
  copyVersionLinkTitle
} from '@components/pages/history/historyShareUrl'
import SidebarLoader from '@components/skeleton/SidebarLoader'
import Button from '@components/ui/Button'
import { useModal } from '@components/ui/ModalDrawer'
import { ScrollArea } from '@components/ui/ScrollArea'
import { Icons } from '@icons'
import { useStore } from '@stores'
import type { HistoryItem } from '@types'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

import {
  dayContainsVersion,
  formatRelativeTime,
  formatTime,
  groupSessionsByDay,
  sessionContainsVersion,
  type VersionSession
} from '../helpers'
import { useVersionContent } from '../hooks/useVersionContent'

/** List row surface — §5.9 + theme tokens; selected mirrors dropdown selected state. */
function historyRowTone(active: boolean) {
  return active ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'
}

function CopyVersionLinkButton({
  version,
  isActiveRow,
  /** When true, no separate hover fill — row surface owns hover (nested list). */
  inlineInRow,
  className
}: {
  version: number
  isActiveRow: boolean
  inlineInRow?: boolean
  className?: string
}) {
  const copyTitle = copyVersionLinkTitle(version)
  return (
    <Button
      type="button"
      variant="ghost"
      shape="square"
      size="sm"
      iconSize={16}
      className={twMerge(
        /* Desktop: align with row text density (§5.1 sm toolbar). Mobile drawer: min touch target §9.2 */
        'rounded-selector shrink-0',
        'min-h-[44px] min-w-[44px] md:min-h-8 md:min-w-8',
        'border-0 shadow-none',
        'bg-transparent active:bg-transparent',
        inlineInRow ? 'hover:bg-transparent' : 'hover:bg-base-300/35',
        isActiveRow ? 'text-primary' : 'text-base-content/45 hover:text-primary',
        /* md+: show copy only on row hover or when this version is active; touch: always visible */
        'transition-opacity duration-150',
        isActiveRow
          ? 'opacity-100'
          : 'opacity-0 max-md:opacity-100 md:group-hover:opacity-100 md:focus-visible:opacity-100',
        className
      )}
      startIcon={Icons.link}
      aria-label={copyTitle}
      tooltip={copyTitle}
      tooltipPlacement="left"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        void copyHistoryVersionLinkToClipboard(version)
      }}
    />
  )
}

const Sidebar = ({ className }: { className?: string }) => {
  const loadingHistory = useStore((state) => state.loadingHistory)
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  const { watchVersionContent } = useVersionContent()
  const { close: closeModal } = useModal() || {}

  const shellClass = twMerge(
    /* §4.1 side panels: base-200 shell */
    'sidebar bg-base-200 border-base-300 h-full min-h-0 w-[25%] shrink-0 border-l',
    className
  )

  if (loadingHistory) return <SidebarLoader />

  if (historyList.length === 0) {
    return (
      <div className={shellClass}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <header className="border-base-300 bg-base-200 sticky top-0 z-10 shrink-0 border-b px-4 py-3">
            <h2 className="text-base-content text-base font-semibold sm:text-lg">
              Version History
            </h2>
            <p className="text-base-content/60 mt-0.5 text-xs sm:text-sm">0 versions</p>
          </header>
          {/* §5.6 empty state */}
          <div className="flex flex-1 flex-col items-center justify-center space-y-3 px-4 py-8">
            <div className="bg-base-300/50 flex size-12 items-center justify-center rounded-full">
              <Icons.history className="text-base-content/40" size={24} aria-hidden />
            </div>
            <div className="text-center">
              <p className="text-base-content/60 font-medium">No versions yet</p>
              <p className="text-base-content/40 mt-1 max-w-[15rem] text-sm leading-relaxed">
                Saved revisions will appear here when you or collaborators edit this document.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!activeHistory) return <SidebarLoader />

  const groupedByDay = groupSessionsByDay(historyList)
  const latestVersion = historyList[0]?.version

  return (
    <div className={shellClass}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="border-base-300 bg-base-200 sticky top-0 z-10 shrink-0 border-b px-4 py-3">
          <h2 className="text-base-content text-base font-semibold sm:text-lg">Version History</h2>
          <p className="text-base-content/60 mt-0.5 text-xs sm:text-sm">
            {historyList.length} version{historyList.length !== 1 ? 's' : ''}
          </p>
        </header>

        <ScrollArea className="min-h-0 flex-1 !pt-0" scrollbarSize="thin" hideScrollbar>
          {Object.entries(groupedByDay).map(([dayLabel, sessions]) => (
            <DayGroup
              key={dayLabel}
              label={dayLabel}
              sessions={sessions}
              activeVersion={activeHistory.version}
              latestVersion={latestVersion}
              onSelectVersion={(version) => {
                watchVersionContent(version)
                closeModal?.()
              }}
              defaultOpen={dayContainsVersion(sessions, activeHistory.version)}
            />
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}

interface DayGroupProps {
  label: string
  sessions: VersionSession[]
  activeVersion: number
  latestVersion: number
  onSelectVersion: (version: number) => void
  defaultOpen: boolean
}

const DayGroup = ({
  label,
  sessions,
  activeVersion,
  latestVersion,
  onSelectVersion,
  defaultOpen
}: DayGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-base-300 border-b">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="ghost"
        className="btn-block bg-base-200 hover:bg-base-300 justify-between rounded-none px-4 py-2.5">
        <span className="text-base-content text-xs font-semibold">{label}</span>
        {isOpen ? (
          <Icons.chevronUp className="text-base-content/50" size={18} />
        ) : (
          <Icons.chevronDown className="text-base-content/50" size={18} />
        )}
      </Button>

      {isOpen && (
        <div className="space-y-2 px-2 py-2">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              activeVersion={activeVersion}
              latestVersion={latestVersion}
              onSelectVersion={onSelectVersion}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SessionItemProps {
  session: VersionSession
  activeVersion: number
  latestVersion: number
  onSelectVersion: (version: number) => void
}

const SessionItem = ({
  session,
  activeVersion,
  latestVersion,
  onSelectVersion
}: SessionItemProps) => {
  const [isExpanded, setIsExpanded] = useState(
    sessionContainsVersion(session, activeVersion) && session.versions.length > 1
  )

  const hasMultipleVersions = session.versions.length > 1
  const isActive = sessionContainsVersion(session, activeVersion)
  const isLatestSession = session.isLatest

  if (!hasMultipleVersions) {
    const version = session.versions[0]
    const isCurrentActive = version.version === activeVersion
    const isLatest = version.version === latestVersion

    return (
      <div
        className={twMerge(
          'group bg-base-100 rounded-box flex min-w-0 items-center gap-1 overflow-hidden border pr-1 transition-colors duration-150 md:pr-1.5',
          historyRowTone(isCurrentActive)
        )}>
        <Button
          onClick={() => onSelectVersion(version.version)}
          variant="ghost"
          className="h-auto min-w-0 flex-1 items-start justify-start gap-3 rounded-none px-3 py-3 text-left shadow-none hover:bg-transparent active:bg-transparent">
          <div className="flex flex-col items-center pt-0.5">
            <HistoryTimelineDot active={isCurrentActive} dimmedHover className="h-2.5 w-2.5" />
          </div>
          <VersionSummary
            version={version}
            active={isCurrentActive}
            showLatest={isLatest}
            titleClassName="text-sm"
          />
        </Button>
        <CopyVersionLinkButton
          version={version.version}
          isActiveRow={isCurrentActive}
          inlineInRow
        />
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'bg-base-100 rounded-box overflow-hidden border transition-colors duration-150',
        historyRowTone(isActive)
      )}>
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="ghost"
        className="btn-block h-auto min-h-[44px] items-start justify-start gap-3 rounded-none px-3 py-3 text-left shadow-none hover:bg-transparent active:bg-transparent">
        <div className="flex flex-col items-center justify-start pt-0.5">
          <span
            className={twMerge(
              'badge badge-sm shrink-0 tabular-nums',
              isActive ? 'badge-primary' : 'badge-ghost border-base-300 border'
            )}>
            {session.versions.length}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
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

        <div className="pt-0.5">
          {isExpanded ? (
            <Icons.chevronUp className="text-base-content/50" size={16} />
          ) : (
            <Icons.chevronDown className="text-base-content/50" size={16} />
          )}
        </div>
      </Button>

      {isExpanded && (
        <ul
          className="border-base-300 m-0 list-none space-y-1 border-t p-2"
          role="list"
          aria-label={`${session.versions.length} revisions in this session`}>
          {session.versions.map((version) => {
            const isCurrentActive = version.version === activeVersion
            const isLatest = version.version === latestVersion

            return (
              <li
                key={version.version}
                className={twMerge(
                  'group rounded-field focus-within:ring-primary/25 flex min-h-11 w-full items-center gap-1 pr-1 transition-colors duration-150 focus-within:ring-2 focus-within:ring-inset md:pr-1.5',
                  isCurrentActive
                    ? 'bg-primary/15 ring-primary/20 ring-1'
                    : isActive
                      ? 'hover:bg-primary/10'
                      : 'hover:bg-base-200'
                )}>
                <Button
                  onClick={() => onSelectVersion(version.version)}
                  variant="ghost"
                  size="sm"
                  className="h-auto min-w-0 flex-1 items-center justify-start gap-2.5 rounded-none px-3 py-2.5 text-left shadow-none hover:bg-transparent active:bg-transparent">
                  <HistoryTimelineDot active={isCurrentActive} className="h-1.5 w-1.5 shrink-0" />
                  <span
                    className={twMerge(
                      'text-sm font-medium',
                      isCurrentActive ? 'text-primary' : 'text-base-content/85'
                    )}>
                    {formatTime(version.createdAt)}
                  </span>
                  {isLatest && <HistoryLatestBadge compact />}
                </Button>
                <CopyVersionLinkButton
                  version={version.version}
                  isActiveRow={isCurrentActive}
                  inlineInRow
                  className="self-center"
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function HistoryTimelineDot({
  active,
  dimmedHover,
  className
}: {
  active: boolean
  dimmedHover?: boolean
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'rounded-full transition-colors',
        active ? 'bg-primary' : 'bg-base-300',
        !active && dimmedHover && 'hover:bg-primary',
        className
      )}
    />
  )
}

function HistoryLatestBadge({ compact }: { compact?: boolean }) {
  return (
    <span className={twMerge('badge badge-primary', compact ? 'badge-xs' : 'badge-sm')}>
      Latest
    </span>
  )
}

function VersionSummary({
  version,
  active,
  showLatest,
  titleClassName
}: {
  version: HistoryItem
  active: boolean
  showLatest: boolean
  titleClassName: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span
          className={twMerge(
            titleClassName,
            'font-medium',
            active ? 'text-primary' : 'text-base-content/90'
          )}>
          {formatTime(version.createdAt)}
        </span>
        {showLatest && <HistoryLatestBadge />}
      </div>
      <p className={twMerge('text-base-content/50 mt-0.5 text-xs', active && 'text-primary/70')}>
        {formatRelativeTime(version.createdAt)}
      </p>
      {version.commitMessage && (
        <p className="text-base-content/70 mt-1 truncate text-sm">{version.commitMessage}</p>
      )}
    </div>
  )
}

export default Sidebar
