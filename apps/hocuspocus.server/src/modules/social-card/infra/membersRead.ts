import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type MemberReadOutcome,
  socialCardMemberReadSeconds,
  socialCardMemberReadsTotal
} from '../../../lib/metrics'
import { getServiceRoleClient } from '../../../lib/supabase'
import type { CardReads } from '../domain/resolveCard'
import { createGuardedRead } from './renderGuards'

const MEMBER_READ_TIMEOUT_MS = 300
const MEMO_MS = 60_000
const MEMO_MAX = 1000
const MEMBER_READS_IN_FLIGHT = 4

/**
 * The card's one service-role read. `resolveCard` calls it only after eligibility, and only a
 * number leaves. A timeout, an error or a full cap gives null, which is never remembered;
 * a count, 0 included, is kept for 60 s. Concurrent reads of one pad share one query.
 */
export const createMembersRead = (
  getClient: () => SupabaseClient | null = getServiceRoleClient,
  timeoutMs = MEMBER_READ_TIMEOUT_MS
): CardReads['members'] => {
  const tally = (outcome: MemberReadOutcome) => socialCardMemberReadsTotal.inc({ outcome })
  const guarded = createGuardedRead<SupabaseClient, number | null>({
    getClient,
    cap: MEMBER_READS_IN_FLIGHT,
    memoMs: MEMO_MS,
    memoMax: MEMO_MAX,
    keep: (count) => count !== null,
    shed: null,
    noClient: null,
    count: tally,
    startTimer: () => socialCardMemberReadSeconds.startTimer()
  })

  const query = async (
    client: SupabaseClient,
    documentId: string
  ): Promise<number | 'timeout' | 'error'> => {
    // abort(), not AbortSignal.timeout: postgrest-js retries a TimeoutError.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const { data, error } = await client
        .rpc('admin_get_document_member_counts', { p_document_ids: [documentId] })
        .abortSignal(controller.signal)
      if (controller.signal.aborted) return 'timeout'
      if (error) return 'error'
      const rows = (data ?? []) as { document_id: string; member_count: number | string }[]
      const count = Number(rows.find((r) => r.document_id === documentId)?.member_count ?? 0)
      return Number.isFinite(count) ? count : 'error'
    } catch {
      return controller.signal.aborted ? 'timeout' : 'error'
    } finally {
      clearTimeout(timer)
    }
  }

  const read = async (client: SupabaseClient, documentId: string): Promise<number | null> => {
    const answer = await query(client, documentId)
    if (typeof answer === 'string') {
      tally(answer)
      return null
    }
    tally('ok')
    return answer
  }

  return (documentId) => guarded(documentId, (client) => read(client, documentId))
}
