import type { Database } from '@types'

import type { MessageStatus } from '../../../types/message'

/**
 * Author profile inlined by fetch_message_window / fetch_messages_since via
 * user_details_json(u). Optional because base-table inserts and realtime
 * `postgres_changes` payloads do not carry it; consumers must fall back to
 * the auth store for those rows.
 */
export type MessageRowUserDetails = {
  id: string
  username: string | null
  fullname: string | null
  avatar_url: string | null
  avatar_updated_at: string | null
}

export type MessageRow = Database['public']['Tables']['messages']['Row'] & {
  user_details?: MessageRowUserDetails | null
  /** Computed per-caller via LEFT JOIN message_bookmarks in fetch_message_window /
   *  fetch_messages_since. Absent on postgres_changes payloads — bookmarks live
   *  in a separate per-user table, so realtime UPDATE on `messages` doesn't carry
   *  bookmark state. `useBookmarkMessageHandler` patches these fields locally
   *  on toggle. */
  is_bookmarked?: boolean | null
  bookmark_id?: number | null
}

export type MessageItem = {
  kind: 'message'
  id: string
  client_id?: string | null
  seq: number | null
  status: MessageStatus
  row: MessageRow
}

export type DayItem = { kind: 'day'; id: string; date: string }
export type UnreadItem = { kind: 'unread'; id: string }
export type ChatItem = MessageItem | DayItem | UnreadItem

/** Virtuoso calls computeItemKey({ data, index, context }); `data` is the
 *  single item, not the array. Returning `id` keeps DOM keys stable across
 *  reorders/prepends so React reconciles in place. */
export const computeItemKey = ({
  data,
  index
}: {
  data: ChatItem
  index: number
  context: unknown
}) => data?.id ?? index
export const isMessage = (i: ChatItem): i is MessageItem => i.kind === 'message'
export const isDay = (i: ChatItem): i is DayItem => i.kind === 'day'
export const isUnread = (i: ChatItem): i is UnreadItem => i.kind === 'unread'
