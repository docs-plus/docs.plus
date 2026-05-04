/**
 * Cursor-based pagination types shared between the API layer, the
 * channelPaginationStore slice, and the useChatroomPagination hook.
 *
 * The cursor is the ISO timestamp of the boundary message. The boolean
 * flags come from the RPC and are the source of truth — never derive
 * them client-side.
 */
export type TPaginationCursors = {
  older_cursor: string | null
  newer_cursor: string | null
  has_more_older: boolean
  has_more_newer: boolean
}

export type TPaginationDirection = 'older' | 'newer'

export type TPaginationState = {
  olderCursor: string | null
  newerCursor: string | null
  hasMoreOlder: boolean
  hasMoreNewer: boolean
  isLoadingOlder: boolean
  isLoadingNewer: boolean
}

export const initialPaginationState: TPaginationState = {
  olderCursor: null,
  newerCursor: null,
  hasMoreOlder: false,
  hasMoreNewer: false,
  isLoadingOlder: false,
  isLoadingNewer: false
}
