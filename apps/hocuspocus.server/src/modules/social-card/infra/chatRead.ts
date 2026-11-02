import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type ChatReadOutcome,
  socialCardChatReadSeconds,
  socialCardChatReadsTotal
} from '../../../lib/metrics'
import { getAnonClient } from '../../../lib/supabase'
import { SUB_ID } from '../domain/cardRequest'
import type { ChatFacts } from '../domain/kinds/types'
import type { CardReads, Indefinite } from '../domain/resolveCard'
import { createSingleFlight } from './renderGuards'

const MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CHAT_READ_TIMEOUT_MS = 300
const MEMO_MS = 60_000
const MEMO_MAX = 1000
export const CHAT_READS_IN_FLIGHT = 4
// Matches the "10+" in `countBucket` (domain/frame.ts): a room never reads more than it can show.
const COUNT_CAP = 10

// Only ids, times, types and counts. Never the message text, its author or a user id.
const ROOM = 'id, heading_id, live:messages(id)'
const LINKED = 'linked:messages(created_at, type, reactions, replied:metadata->replied)'

interface RoomRow {
  id: string
  heading_id: string
  live: { id: string }[] | null
  linked?: { created_at: string; type: string | null; reactions: unknown; replied: unknown }[]
}

/** `reactions` maps each emoji to the people who chose it; the card needs the counts only. */
const reactionCounts = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null) return {}
  const counts: Record<string, number> = {}
  for (const [emoji, people] of Object.entries(value)) {
    if (Array.isArray(people) && people.length > 0) counts[emoji] = people.length
  }
  return counts
}

const toFacts = (documentId: string, row: RoomRow, messageId?: string): ChatFacts => {
  const linked = messageId ? row.linked?.[0] : undefined
  return {
    // The pad's own room has its document id as its heading id.
    headingId: row.heading_id === documentId ? null : row.heading_id,
    count: Math.min(COUNT_CAP, row.live?.length ?? 0),
    message: linked
      ? {
          createdAt: new Date(linked.created_at),
          type: linked.type ?? 'text',
          reactions: reactionCounts(linked.reactions),
          replies: Array.isArray(linked.replied) ? linked.replied.length : 0
        }
      : null
  }
}

/**
 * The anon chat read behind the Chat and Message cards (#667). RLS decides what a crawler may
 * see, so a Private pad or a closed room reads as absent (null). A timeout, an error or a full
 * cap (`'shed'`) is indefinite and is never remembered; a found or absent room is kept for 60 s.
 * Concurrent reads of one key share one query, so one shared link spends one cap slot.
 */
export const createChatRead = (
  getClient: () => SupabaseClient | null = getAnonClient,
  timeoutMs = CHAT_READ_TIMEOUT_MS
): CardReads['chat'] => {
  const memo = new Map<string, { at: number; facts: ChatFacts | null }>()
  let inFlight = 0
  const shared = createSingleFlight<ChatFacts | null | Indefinite>()
  const count = (outcome: ChatReadOutcome) => socialCardChatReadsTotal.inc({ outcome })

  const remember = (key: string, facts: ChatFacts | null) => {
    memo.delete(key)
    memo.set(key, { at: Date.now(), facts })
    // Insertion order makes the first key the oldest.
    if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value as string)
  }

  const readRoom = async (
    client: SupabaseClient,
    key: string,
    documentId: string,
    linkId: string,
    messageId: string | undefined
  ): Promise<ChatFacts | null | Indefinite> => {
    if (inFlight >= CHAT_READS_IN_FLIGHT) {
      count('shed')
      return 'shed'
    }

    inFlight++
    const stop = socialCardChatReadSeconds.startTimer()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      let query = client
        .from('channels')
        .select(messageId ? `${ROOM}, ${LINKED}` : ROOM)
        .eq('workspace_id', documentId)
        .or(`id.eq.${linkId},heading_id.eq.${linkId}`)
        .is('live.deleted_at', null)
        .neq('live.type', 'notification')
        .limit(COUNT_CAP, { referencedTable: 'live' })
      if (messageId) {
        query = query
          .eq('linked.id', messageId)
          .is('linked.deleted_at', null)
          .limit(1, { referencedTable: 'linked' })
      }
      const { data, error } = await query.limit(2).abortSignal(controller.signal)
      if (controller.signal.aborted) {
        count('timeout')
        return 'unavailable'
      }
      if (error) {
        count('error')
        return 'unavailable'
      }
      const rows = (data ?? []) as unknown as RoomRow[]
      // A channel id match wins over a heading id match in the same pad.
      const row = rows.find((r) => r.id === linkId) ?? rows[0]
      const facts = row ? toFacts(documentId, row, messageId) : null
      count(facts ? 'ok' : 'missing')
      remember(key, facts)
      return facts
    } catch {
      count(controller.signal.aborted ? 'timeout' : 'error')
      return 'unavailable'
    } finally {
      clearTimeout(timer)
      stop()
      inFlight--
    }
  }

  return async (documentId, linkId, messageId) => {
    // Checked again here: the id goes into a PostgREST filter string.
    if (!SUB_ID.test(linkId) || (messageId !== undefined && !MESSAGE_ID.test(messageId))) {
      count('rejected')
      return null
    }
    const key = `${documentId}\u0000${linkId}\u0000${messageId ?? ''}`
    const hit = memo.get(key)
    if (hit && Date.now() - hit.at < MEMO_MS) {
      count('memo')
      return hit.facts
    }
    const client = getClient()
    if (!client) {
      count('error')
      return 'unavailable'
    }
    let joined = true
    const result = await shared(key, () => {
      joined = false
      return readRoom(client, key, documentId, linkId, messageId)
    })
    if (joined) count('joined')
    return result
  }
}
