import { Avatar } from '@components/ui/Avatar'
import { popoverPanelClassName } from '@components/ui/Popover'
import { formatTimeAgo } from '@utils/formatTime'
import { twMerge } from 'tailwind-merge'

import { type DocumentRosterMember, useDocumentRoster } from '../hooks/useDocumentRoster'
import { formatShortDate } from '../utils/formatShortDate'

interface DocumentMembersRosterProps {
  slug: string
  // Passed from the cluster so the header count is correct during the loading skeleton.
  memberCount: number
}

const nameOf = (m: DocumentRosterMember) =>
  m.display_name || m.full_name || m.username || 'Anonymous'

// A first visit lands `updated_at` within a heartbeat of `created_at`; below the
// threshold "Last seen" restates "Joined", so suppress it.
const seenAfterJoin = (joined: string, lastVisit: string) =>
  Math.abs(new Date(lastVisit).getTime() - new Date(joined).getTime()) >= 60_000

/**
 * Roster popover panel — lazy-fetches on open (it only mounts inside PopoverContent).
 * Two-line rows: avatar + name (+ "You"), then join date and optional last-seen.
 */
function DocumentMembersRoster({ slug, memberCount }: DocumentMembersRosterProps) {
  const { data: members, isLoading, isError, refetch } = useDocumentRoster(slug)

  return (
    <div className={twMerge(popoverPanelClassName, 'w-64 overflow-hidden p-0')}>
      <div className="border-base-300 border-b px-3 py-2">
        <span className="text-base-content text-sm font-medium">{memberCount} people</span>
      </div>

      <div className="max-h-72 overflow-y-auto py-1">
        {isLoading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2">
              <div className="skeleton size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton rounded-field h-3 w-2/3" />
                <div className="skeleton rounded-field h-2.5 w-1/2" />
              </div>
            </div>
          ))
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
            <p className="text-base-content/60 text-xs">Couldn’t load people</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-primary text-xs font-medium hover:underline">
              Retry
            </button>
          </div>
        ) : (
          (members ?? []).map((m) => (
            <div key={m.member_id} className="flex items-center gap-2.5 px-3 py-2">
              <Avatar
                size="sm"
                clickable={false}
                id={m.member_id}
                src={m.avatar_url}
                alt={nameOf(m)}
                avatarUpdatedAt={m.avatar_updated_at}
                className="shrink-0"
              />
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="text-base-content truncate text-sm font-medium">
                    {nameOf(m)}
                  </span>
                  {m.is_caller && (
                    <span className="bg-base-200 text-base-content/60 rounded-full px-1.5 py-px text-[10px] font-medium">
                      You
                    </span>
                  )}
                </span>
                <span className="text-base-content/50 truncate text-xs">
                  Joined {formatShortDate(m.joined_at)}
                  {seenAfterJoin(m.joined_at, m.last_visit_at) &&
                    ` · Last seen ${formatTimeAgo(m.last_visit_at)} ago`}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default DocumentMembersRoster
