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

const Sidebar = ({ className }: { className?: string }) => {
  const loadingHistory = useStore((state) => state.loadingHistory)
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  const { watchVersionContent } = useVersionContent()
  const { close: closeModal } = useModal() || {}

  if (loadingHistory || !activeHistory) return <SidebarLoader />

  const groupedByDay = groupSessionsByDay(historyList)
  const latestVersion = historyList[0]?.version

  return (
    <div
      className={twMerge(
        'sidebar bg-base-100 border-base-300 h-full min-h-0 w-[25%] shrink-0 border-l',
        className
      )}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-base-300 shrink-0 border-b px-4 py-4">
          <h2 className="text-base-content text-lg font-bold">Version History</h2>
          <p className="text-base-content/60 mt-0.5 text-xs">
            {historyList.length} version{historyList.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Version List */}
        <ScrollArea className="min-h-0 flex-1" scrollbarSize="thin" hideScrollbar>
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
      {/* Day Header */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="ghost"
        className="bg-base-200 hover:bg-base-300 flex w-full cursor-pointer items-center justify-between rounded-none px-4 py-2.5 transition-colors">
        <span className="text-base-content text-sm font-semibold">{label}</span>
        {isOpen ? (
          <Icons.chevronUp className="text-base-content/50" size={18} />
        ) : (
          <Icons.chevronDown className="text-base-content/50" size={18} />
        )}
      </Button>

      {/* Sessions */}
      {isOpen && (
        <div className="py-1">
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
      <Button
        onClick={() => onSelectVersion(version.version)}
        variant="ghost"
        className={twMerge(
          'flex h-auto w-full cursor-pointer items-start gap-3 rounded-none px-4 py-2 text-left transition-all',
          isCurrentActive
            ? 'bg-primary/15 hover:bg-base-300'
            : 'hover:bg-base-200 active:bg-base-200'
        )}>
        <div className="flex flex-col items-center pt-1">
          <HistoryTimelineDot active={isCurrentActive} dimmedHover className="h-2.5 w-2.5" />
        </div>
        <VersionSummary
          version={version}
          active={isCurrentActive}
          showLatest={isLatest}
          titleClassName="text-sm"
        />
      </Button>
    )
  }

  return (
    <div className={twMerge('transition-colors', isActive ? 'bg-primary/5' : '')}>
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="ghost"
        className={twMerge(
          'flex h-auto w-full cursor-pointer items-start gap-3 rounded-none px-4 py-2 text-left transition-all',
          'hover:bg-base-200/50 active:bg-base-200'
        )}>
        <div className="flex flex-col items-center pt-1">
          <div className="relative">
            <HistoryTimelineDot active={isActive} className="h-2.5 w-2.5" />
            <span className="bg-base-content text-base-100 absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
              {session.versions.length}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={twMerge(
                'text-sm font-medium',
                isActive ? 'text-primary' : 'text-base-content'
              )}>
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </span>
            {isLatestSession && <HistoryLatestBadge />}
          </div>
          <p
            className={twMerge(
              'mt-0.5 text-xs',
              isActive ? 'text-primary/70' : 'text-base-content/50'
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
        <div className="border-base-200 ml-[26px] border-l-2 py-1 pl-4">
          {session.versions.map((version) => {
            const isCurrentActive = version.version === activeVersion
            const isLatest = version.version === latestVersion

            return (
              <Button
                key={version.version}
                onClick={() => onSelectVersion(version.version)}
                variant="ghost"
                size="sm"
                className={twMerge(
                  'flex h-auto w-full cursor-pointer items-center justify-start gap-2.5 rounded px-2 py-1.5 text-left transition-all',
                  isCurrentActive
                    ? 'bg-primary/15 hover:bg-primary/20'
                    : 'hover:bg-base-200/60 active:bg-base-200'
                )}>
                <HistoryTimelineDot active={isCurrentActive} className="h-1.5 w-1.5" />
                <span
                  className={twMerge(
                    'text-xs font-medium',
                    isCurrentActive ? 'text-primary' : 'text-base-content/80'
                  )}>
                  {formatTime(version.createdAt)}
                </span>
                {isLatest && <HistoryLatestBadge compact />}
              </Button>
            )
          })}
        </div>
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
    <span
      className={twMerge(
        'bg-primary text-primary-content rounded-sm font-semibold',
        compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'
      )}>
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
            active ? 'text-primary' : 'text-base-content'
          )}>
          {formatTime(version.createdAt)}
        </span>
        {showLatest && <HistoryLatestBadge />}
      </div>
      <p className={twMerge('mt-0.5 text-xs', active ? 'text-primary/70' : 'text-base-content/50')}>
        {formatRelativeTime(version.createdAt)}
      </p>
      {version.commitMessage && (
        <p className="text-base-content/70 mt-1 truncate text-xs">{version.commitMessage}</p>
      )}
    </div>
  )
}

export default Sidebar
