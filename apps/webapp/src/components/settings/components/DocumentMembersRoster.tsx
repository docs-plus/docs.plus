import { Avatar } from '@components/ui/Avatar'
import { EmptyState } from '@components/ui/EmptyState'
import { popoverPanelClassName } from '@components/ui/Popover'
import { formatTimeAgo } from '@utils/formatTime'
import { twMerge } from '@utils/twMerge'

import { type DocumentRosterMember, useDocumentRoster } from '../hooks/useDocumentRoster'
import { formatShortDate } from '../utils/formatShortDate'

interface DocumentMembersRosterProps {
  workspaceId: string
  // Passed from the cluster so the header count is correct during the loading skeleton.
  memberCount: number
}

const nameOf = (m: DocumentRosterMember) =>
  m.display_name || m.full_name || m.username || 'Anonymous'

// A first visit lands `updated_at` within a heartbeat of `created_at`; below the
// threshold "Last seen" restates "Joined", so suppress it.
const seenAfterJoin = (joined: string, lastVisit: string) =>
  Math.abs(new Date(lastVisit).getTime() - new Date(joined).getTime()) >= 60_000

/** Lazy-fetches on open — the host only mounts inside PopoverContent. */
function DocumentMembersRoster({ workspaceId, memberCount }: DocumentMembersRosterProps) {
  const { data: members, isLoading, isError, isFetching, refetch } = useDocumentRoster(workspaceId)

  return (
    <div className={twMerge(popoverPanelClassName, 'w-64 overflow-hidden p-0')}>
      <div className="border-base-300 border-b px-4 py-3">
        <span className="text-base-content text-base font-semibold">{memberCount} people</span>
      </div>

      <div className="max-h-72 overflow-y-auto py-1">
        {isLoading ? (
          // One row per member; five already fill the `max-h-72` body.
          Array.from({ length: Math.min(memberCount, 5) }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2" aria-hidden>
              <div className="skeleton size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex h-5 items-center">
                  <div className="skeleton h-3.5 w-2/3" />
                </div>
                <div className="flex h-5 items-center">
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : isError ? (
          <EmptyState
            layout="inline"
            tone="error"
            title="Couldn’t load people."
            className="px-3"
            onRetry={refetch}
            retrying={isFetching}
          />
        ) : (
          (members ?? []).map((m) => (
            <div key={m.member_id} className="flex items-center gap-2.5 px-3 py-2">
              <Avatar size="sm" clickable={false} face={m} alt={nameOf(m)} className="shrink-0" />
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
                <span className="text-meta text-base-content/60 truncate">
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
