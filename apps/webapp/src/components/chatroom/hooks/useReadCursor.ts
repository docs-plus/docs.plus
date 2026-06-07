import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useRef } from 'react'

/**
 * Debounced advance_read_cursor caller. Anon callers no-op per AGENTS.md
 * §Anonymous Chat Read Path; rows where `status !== 'sent'` are skipped
 * per §Optimistic Message Lifecycle. Reads uid from the auth store so we
 * don't issue an extra `/auth/v1/user` round-trip per chatroom mount.
 */
export const useReadCursor = (channelId: string) => {
  const lastAdvancedRef = useRef<number>(0)
  const debounceTimerRef = useRef<number | null>(null)

  const advance = useCallback(
    (upToSeq: number, status: string | undefined | null) => {
      const uid = (useAuthStore.getState().profile as { id?: string } | null)?.id ?? null
      if (!uid) return
      if (!(status === 'sent' || !status)) return
      if (upToSeq <= lastAdvancedRef.current) return
      lastAdvancedRef.current = upToSeq
      if (debounceTimerRef.current != null) window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = window.setTimeout(() => {
        // The Supabase JS builder is lazy: the request is only dispatched
        // when awaited or `.then()`'d. The fire-and-forget call without a
        // continuation never reached the server.
        void supabaseClient
          .rpc('advance_read_cursor', {
            p_channel_id: channelId,
            p_up_to_seq: upToSeq
          })
          .then((res) => {
            if (res.error) {
              console.warn('[chatroom] advance_read_cursor error:', res.error)
            }
          })
      }, 1000)
    },
    [channelId]
  )

  return { advance }
}
