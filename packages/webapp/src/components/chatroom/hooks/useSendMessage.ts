import type { ChatItem, MessageItem } from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import { isDuplicateKeyError } from '@components/chatroom/utils/postgresErrors'
import { retryMessage } from '@components/chatroom/utils/retryMessage'
import { useAuthStore } from '@stores'
import { generateClientMessageId } from '@utils/clientMessageId'
import { supabaseClient } from '@utils/supabase'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

export type SendDraft = {
  content: string
  html?: string | null
  reply_to_message_id?: string | null
}

export type UseSendMessageArgs = {
  channelId: string
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>
  dataIncludesTailRef: React.MutableRefObject<boolean>
  snapToPresent: () => Promise<void>
  onAuthRequired: () => void
}

export const useSendMessage = ({
  channelId,
  listRef,
  dataIncludesTailRef,
  snapToPresent,
  onAuthRequired
}: UseSendMessageArgs) => {
  // uid is sourced from the auth store, not a per-hook auth.getUser() round-trip.
  // Two chatroom hooks (useSendMessage, useReadCursor) were each firing their own
  // /auth/v1/user GET on mount; with React 18 StrictMode in dev that compounds to 4
  // extra calls per channel open.
  const readUid = () => (useAuthStore.getState().profile as { id?: string } | null)?.id ?? null

  const send = useCallback(
    async (draft: SendDraft) => {
      const uid = readUid()
      if (!uid) {
        onAuthRequired()
        return
      }
      if (!dataIncludesTailRef.current) await snapToPresent()

      const clientId = generateClientMessageId()
      const userId = uid
      const html = draft.html ?? null
      // Hydrate user_details from the auth store so MessageCard renders the
      // sender's avatar and name on the optimistic row. Realtime echo payloads
      // are raw `messages.*` without the join, so the merge in
      // useChannelRealtime preserves these fields.
      const profile = useAuthStore.getState().profile as {
        id?: string
        username?: string | null
        full_name?: string | null
        avatar_url?: string | null
        avatar_updated_at?: string | null
      } | null
      const userDetails = profile
        ? {
            id: userId,
            username: profile.username ?? null,
            fullname: profile.full_name ?? null,
            avatar_url: profile.avatar_url ?? null,
            avatar_updated_at: profile.avatar_updated_at ?? null
          }
        : null
      const optimistic: MessageItem = {
        kind: 'message',
        id: clientId,
        client_id: clientId,
        seq: null,
        status: 'pending',
        row: {
          id: clientId,
          client_id: clientId,
          channel_id: channelId,
          user_id: userId,
          content: draft.content,
          html,
          reply_to_message_id: draft.reply_to_message_id ?? null,
          created_at: new Date().toISOString(),
          user_details: userDetails
        } as any
      }
      // Discord / Slack / Telegram parity: a user's OWN send always scrolls
      // to the tail so they can see what they just typed — regardless of
      // whether they had scrolled up to re-read history. The "don't yank
      // scrolled-up readers" rule applies only to OTHER people's arrivals
      // (see useChannelRealtime's autoscroll callback, which keeps the
      // `atBottom` gate). Returning `'smooth'` unconditionally tells
      // Virtuoso to animate to the new last item.
      listRef.current?.data.append([optimistic], () => 'smooth')

      try {
        // Single-id model per AGENTS.md §Optimistic Message Lifecycle:
        // the FE-generated UUID is the canonical row id. The legacy
        // `client_id` column is left NULL on v2 sends; the PK uniqueness
        // is what gates retries (`isDuplicateKeyError` catches 23505).
        // `user_id` satisfies messages_self_insert (`user_id = auth.uid()`).
        const { error } = await (supabaseClient as any).from('messages').insert({
          id: clientId,
          channel_id: channelId,
          user_id: userId,
          content: draft.content,
          html,
          reply_to_message_id: draft.reply_to_message_id ?? null
        })
        if (error) {
          const status: 'sent' | 'failed' = isDuplicateKeyError(error) ? 'sent' : 'failed'
          listRef.current?.data.map((i) =>
            isMessage(i) && i.client_id === clientId ? { ...(i as MessageItem), status } : i
          )
        }
      } catch {
        listRef.current?.data.map((i) =>
          isMessage(i) && i.client_id === clientId
            ? { ...(i as MessageItem), status: 'failed' as const }
            : i
        )
      }
    },
    [channelId, listRef, dataIncludesTailRef, snapToPresent, onAuthRequired]
  )

  const retry = useCallback(
    async (clientId: string) => {
      if (!readUid()) {
        onAuthRequired()
        return
      }
      let target: MessageItem | null = null
      listRef.current?.data.map((i) => {
        if (isMessage(i) && i.client_id === clientId) {
          target = i as MessageItem
          return { ...(i as MessageItem), status: 'pending' as const }
        }
        return i
      })
      if (!target) return
      const row = (target as MessageItem).row
      const result = await retryMessage({
        id: clientId,
        channel_id: channelId,
        content: row.content ?? '',
        html: row.html ?? null,
        reply_to_message_id: row.reply_to_message_id ?? null
      })
      listRef.current?.data.map((i) =>
        isMessage(i) && i.client_id === clientId
          ? { ...(i as MessageItem), status: result.ok ? ('sent' as const) : ('failed' as const) }
          : i
      )
    },
    [channelId, listRef, onAuthRequired]
  )

  return { send, retry }
}
