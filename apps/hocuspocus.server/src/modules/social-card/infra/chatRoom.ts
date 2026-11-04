import type { SupabaseClient } from '@supabase/supabase-js'

import { MESSAGE_ID, SUB_ID } from '../domain/cardRequest'

/** A chat room the read found. Counts and dates only. */
export interface ChatRoom {
  /** The pad's own room has the documentId as its heading id. */
  headingId: string
  /** Every live message, notices included: the number the app shows for a room. */
  messages: number
  lastMessageAt: Date | null
  /** Null when no message id was asked for, or the room does not hold it. */
  message: {
    sentAt: Date
    type: string
    /** People per emoji. Never who they are. */
    reactions: Record<string, number>
    replies: number
  } | null
}

export interface RoomQuery {
  documentId: string
  linkId: string
  /** `heading` finds the room by `heading_id` only (#402); `link` also takes a channel id. */
  match: 'heading' | 'link'
  messageId?: string
  timeoutMs: number
}

export type RoomRead =
  | { status: 'ok'; room: ChatRoom | null }
  | { status: 'rejected' }
  | { status: 'timeout' }
  | { status: 'error'; code: string }

// Ids, times, types and counts. Never message text, an author or a user id. The count and
// `last` both include notices, so a card never says "3 messages" with no last message.
const ROOM = 'id, heading_id, channel_message_counts(message_count), last:messages(created_at)'
const LINKED = 'linked:messages(created_at, type, reactions, replied:metadata->replied)'

interface RoomRow {
  id: string
  heading_id: string
  channel_message_counts: { message_count: number } | { message_count: number }[] | null
  last: { created_at: string }[] | null
  linked?: { created_at: string; type: string | null; reactions: unknown; replied: unknown }[]
}

const embedded = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null)

/** `reactions` maps each emoji to the people who chose it; only the counts leave. */
const reactionCounts = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null) return {}
  const counts: Record<string, number> = {}
  for (const [emoji, people] of Object.entries(value)) {
    if (Array.isArray(people) && people.length > 0) counts[emoji] = people.length
  }
  return counts
}

const toRoom = (row: RoomRow, messageId: string | undefined): ChatRoom => {
  const last = row.last?.[0]?.created_at
  const linked = messageId ? row.linked?.[0] : undefined
  return {
    headingId: row.heading_id,
    messages: embedded(row.channel_message_counts)?.message_count ?? 0,
    lastMessageAt: last ? new Date(last) : null,
    message: linked
      ? {
          sentAt: new Date(linked.created_at),
          type: linked.type ?? 'text',
          reactions: reactionCounts(linked.reactions),
          replies: Array.isArray(linked.replied) ? linked.replied.length : 0
        }
      : null
  }
}

/**
 * One chat room of one pad, live and public, with its linked message when asked. The client
 * is the caller's policy: anon lets RLS hide a Private pad, and the service role does not.
 * The type and deleted filters match the anon policy, so they matter for the service role only.
 */
export const readChatRoom = async (client: SupabaseClient, q: RoomQuery): Promise<RoomRead> => {
  // Checked again here: the ids go into PostgREST filters.
  if (!SUB_ID.test(q.linkId) || (q.messageId !== undefined && !MESSAGE_ID.test(q.messageId))) {
    return { status: 'rejected' }
  }
  // abort(), not AbortSignal.timeout: postgrest-js retries a TimeoutError.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), q.timeoutMs)
  try {
    let query = client
      .from('channels')
      .select(q.messageId ? `${ROOM}, ${LINKED}` : ROOM)
      .eq('workspace_id', q.documentId)
      .or(
        q.match === 'heading'
          ? `heading_id.eq.${q.linkId}`
          : `id.eq.${q.linkId},heading_id.eq.${q.linkId}`
      )
      .eq('type', 'PUBLIC')
      .is('deleted_at', null)
      .is('last.deleted_at', null)
      .order('created_at', { referencedTable: 'last', ascending: false })
      .limit(1, { referencedTable: 'last' })
    if (q.messageId) {
      query = query
        .eq('linked.id', q.messageId)
        .is('linked.deleted_at', null)
        .limit(1, { referencedTable: 'linked' })
    }
    const { data, error } = await query.limit(2).abortSignal(controller.signal)
    if (controller.signal.aborted) return { status: 'timeout' }
    // PostgREST error details can carry row text, so only the code leaves.
    if (error) return { status: 'error', code: error.code ?? 'unknown' }
    const rows = (data ?? []) as unknown as RoomRow[]
    // A channel id match wins over a heading id match in the same pad.
    const row = rows.find((r) => r.id === q.linkId) ?? rows[0]
    return { status: 'ok', room: row ? toRoom(row, q.messageId) : null }
  } catch {
    return controller.signal.aborted ? { status: 'timeout' } : { status: 'error', code: 'thrown' }
  } finally {
    clearTimeout(timer)
  }
}
