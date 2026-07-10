import AvatarStack from '@components/AvatarStack'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/Popover'

import { type DocumentMemberPreview } from '../hooks/useDocumentMembers'
import DocumentMembersRoster from './DocumentMembersRoster'

interface DocumentMembersClusterProps {
  slug: string
  memberCount: number
  previews: DocumentMemberPreview[]
  size?: 'xs' | 'sm'
  /** List rows demote this to -1 so the roving tabindex keeps one tab stop per row. */
  tabIndex?: number
}

/**
 * Inline avatar cluster on a document row/tile — the trigger for the roster popover.
 * Solo documents (owner only) show nothing; the button is a sibling of the row's nav
 * button and stops propagation so opening the roster never navigates the row.
 */
function DocumentMembersCluster({
  slug,
  memberCount,
  previews,
  size = 'sm',
  tabIndex
}: DocumentMembersClusterProps) {
  if (memberCount <= 1) return null

  const users = previews.slice(0, 3).map((p) => ({
    id: p.member_id,
    avatar_url: p.avatar_url,
    avatar_updated_at: p.avatar_updated_at,
    display_name: p.display_name
  }))

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${memberCount} people have this document`}
          tabIndex={tabIndex}
          onClick={(e) => e.stopPropagation()}
          className="rounded-field focus-visible:ring-primary inline-flex min-h-11 shrink-0 items-center justify-center focus-visible:ring-2 focus-visible:outline-none sm:min-h-9">
          <AvatarStack users={users} size={size} clickable={false} overflowCount={memberCount} />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <DocumentMembersRoster slug={slug} memberCount={memberCount} />
      </PopoverContent>
    </Popover>
  )
}

export default DocumentMembersCluster
