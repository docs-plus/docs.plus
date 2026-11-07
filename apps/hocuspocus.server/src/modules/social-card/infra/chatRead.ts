import type { SupabaseClient } from '@supabase/supabase-js'

import { COUNT_CAP } from '../../../lib/cardText'
import {
  type ChatReadOutcome,
  socialCardChatReadSeconds,
  socialCardChatReadsTotal
} from '../../../lib/metrics'
import { getAnonClient } from '../../../lib/supabase'
import { MESSAGE_ID, SUB_ID } from '../domain/cardRequest'
import type { ChatFacts } from '../domain/kinds/types'
import type { CardReads, Indefinite } from '../domain/resolveCard'
import { type ChatRoom, readChatRoom } from './chatRoom'
import { createGuardedRead } from './renderGuards'

const CHAT_READ_TIMEOUT_MS = 300
const MEMO_MS = 60_000
const MEMO_MAX = 1000
export const CHAT_READS_IN_FLIGHT = 4

const toFacts = (documentId: string, room: ChatRoom): ChatFacts => ({
  // The pad's own room has its document id as its heading id.
  headingId: room.headingId === documentId ? null : room.headingId,
  count: Math.min(COUNT_CAP, room.messages),
  message: room.message && {
    createdAt: room.message.sentAt,
    type: room.message.type,
    reactions: room.message.reactions,
    replies: room.message.replies
  }
})

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
  const count = (outcome: ChatReadOutcome) => socialCardChatReadsTotal.inc({ outcome })
  const guarded = createGuardedRead<SupabaseClient, ChatFacts | null | Indefinite>({
    getClient,
    cap: CHAT_READS_IN_FLIGHT,
    memoMs: MEMO_MS,
    memoMax: MEMO_MAX,
    keep: (facts) => typeof facts !== 'string',
    shed: 'shed',
    noClient: 'unavailable',
    count,
    startTimer: () => socialCardChatReadSeconds.startTimer()
  })

  const readRoom = async (
    client: SupabaseClient,
    documentId: string,
    linkId: string,
    messageId: string | undefined
  ): Promise<ChatFacts | null | Indefinite> => {
    const read = await readChatRoom(client, {
      documentId,
      linkId,
      match: 'link',
      messageId,
      timeoutMs
    })
    // No `rejected` arm: the id check below runs before this read, so it never sees one.
    if (read.status !== 'ok') {
      count(read.status === 'timeout' ? 'timeout' : 'error')
      return 'unavailable'
    }
    const facts = read.room ? toFacts(documentId, read.room) : null
    count(facts ? 'ok' : 'missing')
    return facts
  }

  return async (documentId, linkId, messageId) => {
    // Before the memo and the cap, so a bad id is a definite miss, never a shed.
    if (!SUB_ID.test(linkId) || (messageId !== undefined && !MESSAGE_ID.test(messageId))) {
      count('rejected')
      return null
    }
    const key = `${documentId}\u0000${linkId}\u0000${messageId ?? ''}`
    return guarded(key, (client) => readRoom(client, documentId, linkId, messageId))
  }
}
