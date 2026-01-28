import SidebarLoader from '@components/skeleton/SidebarLoader'
import { useStore } from '@stores'
import { useState } from 'react'
import { MdExpandMore, MdExpandLess } from 'react-icons/md'
import {
  groupSessionsByDay,
  dayContainsVersion,
  sessionContainsVersion,
  formatTime,
  formatRelativeTime,
  type VersionSession
} from '../helpers'
import { useVersionContent } from '../hooks/useVersionContent'
import { twMerge } from 'tailwind-merge'
import { useModal } from '@components/ui/ModalDrawer'
import Button from '@components/ui/Button'

const Sidebar = ({ className }: { className?: string }) => {
  const { loadingHistory, activeHistory, historyList } = useStore((state) => state)
  const { watchVersionContent } = useVersionContent()
  const { close: closeModal } = useModal() || {}

  if (loadingHistory || !activeHistory) return <SidebarLoader />

  const groupedByDay = groupSessionsByDay(historyList)
  const latestVersion = historyList[0]?.version

  return (
    <div
      className={twMerge('sidebar bg-base-100 border-base-300 h-full w-[25%] border-l', className)}>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-base-300 border-b px-4 py-4">
          <h2 className="text-base-content text-lg font-bold">Version History</h2>
          <p className="text-base-content/60 mt-0.5 text-xs">
            {historyList.length} version{historyList.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto">
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
        </div>
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
          <MdExpandLess className="text-base-content/50" size={18} />
        ) : (
          <MdExpandMore className="text-base-content/50" size={18} />
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

  // Single version - show directly
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
        {/* Timeline dot */}
        <div className="flex flex-col items-center pt-1">
          <div
            className={twMerge(
              'hover:bg-primary h-2.5 w-2.5 rounded-full transition-colors',
              isCurrentActive ? 'bg-primary' : 'bg-base-300'
            )}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={twMerge(
                'text-sm font-medium',
                isCurrentActive ? 'text-primary' : 'text-base-content'
              )}>
              {formatTime(version.createdAt)}
            </span>
            {isLatest && (
              <span className="bg-primary text-primary-content rounded-sm px-1.5 py-0.5 text-[10px] font-semibold">
                Latest
              </span>
            )}
          </div>
          <p
            className={twMerge(
              'mt-0.5 text-xs',
              isCurrentActive ? 'text-primary/70' : 'text-base-content/50'
            )}>
            {formatRelativeTime(version.createdAt)}
          </p>
          {version.commitMessage && (
            <p className="text-base-content/70 mt-1 truncate text-xs">{version.commitMessage}</p>
          )}
        </div>
      </Button>
    )
  }

  // Multiple versions - collapsible session
  return (
    <div className={twMerge('transition-colors', isActive ? 'bg-primary/5' : '')}>
      {/* Session header */}
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="ghost"
        className={twMerge(
          'flex h-auto w-full cursor-pointer items-start gap-3 rounded-none px-4 py-2 text-left transition-all',
          'hover:bg-base-200/50 active:bg-base-200'
        )}>
        {/* Timeline dot with count badge */}
        <div className="flex flex-col items-center pt-1">
          <div className="relative">
            <div
              className={twMerge(
                'h-2.5 w-2.5 rounded-full transition-colors',
                isActive ? 'bg-primary' : 'bg-base-300'
              )}
            />
            {/* Count badge */}
            <span className="bg-base-content text-base-100 absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
              {session.versions.length}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={twMerge(
                'text-sm font-medium',
                isActive ? 'text-primary' : 'text-base-content'
              )}>
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </span>
            {isLatestSession && (
              <span className="bg-primary text-primary-content rounded-sm px-1.5 py-0.5 text-[10px] font-semibold">
                Latest
              </span>
            )}
          </div>
          <p
            className={twMerge(
              'mt-0.5 text-xs',
              isActive ? 'text-primary/70' : 'text-base-content/50'
            )}>
            {session.versions.length} changes · {formatRelativeTime(session.endTime)}
          </p>
        </div>

        {/* Expand icon */}
        <div className="pt-0.5">
          {isExpanded ? (
            <MdExpandLess className="text-base-content/50" size={16} />
          ) : (
            <MdExpandMore className="text-base-content/50" size={16} />
          )}
        </div>
      </Button>

      {/* Expanded versions list */}
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
                {/* Mini dot */}
                <div
                  className={twMerge(
                    'h-1.5 w-1.5 rounded-full',
                    isCurrentActive ? 'bg-primary' : 'bg-base-300'
                  )}
                />

                <span
                  className={twMerge(
                    'text-xs font-medium',
                    isCurrentActive ? 'text-primary' : 'text-base-content/80'
                  )}>
                  {formatTime(version.createdAt)}
                </span>

                {isLatest && (
                  <span className="bg-primary text-primary-content rounded-sm px-1 py-0.5 text-[9px] font-semibold">
                    Latest
                  </span>
                )}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Sidebar
