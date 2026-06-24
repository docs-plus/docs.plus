import type {
  ChatItem,
  MessageItem,
  MessageRow,
  MessageRowUserDetails
} from '@components/chatroom/types/chat-items'
import { isMessage } from '@components/chatroom/types/chat-items'
import type { SendDraft, SendResult } from '@components/chatroom/types/send.types'
import type { ChannelFeedMode } from '@components/chatroom/utils/channelFeedProjection'
import { showOptimisticMessageInFeed } from '@components/chatroom/utils/channelFeedProjection'
import { profileToMessageRowUserDetails } from '@components/chatroom/utils/chatUserDetails'
import { persistChatMessage, retryChatMessage } from '@components/chatroom/utils/sendChatMessage'
import { useAuthStore } from '@stores'
import { generateClientMessageId } from '@utils/clientMessageId'
import type { VirtuosoMessageListMethods } from '@virtuoso.dev/message-list'
import { useCallback } from 'react'

export type { SendDraft, SendResult } from '@components/chatroom/types/send.types'

const buildOptimisticMessageRow = (
  clientId: string,
  channelId: string,
  uid: string,
  draft: SendDraft,
  userDetails: MessageRowUserDetails | null
): MessageRow => {
  const createdAt = new Date().toISOString()
  return {
    id: clientId,
    client_id: clientId,
    channel_id: channelId,
    user_id: uid,
    content: draft.content,
    html: draft.html ?? null,
    medias: (draft.medias ?? null) as MessageRow['medias'],
    type: draft.type ?? null,
    reply_to_message_id: draft.reply_to_message_id ?? null,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
    edited_at: null,
    metadata: null,
    reactions: null,
    readed_at: null,
    replied_message_preview: null,
    seq: 0,
    user_details: userDetails
  }
}

const buildOptimisticMessageItem = (
  clientId: string,
  channelId: string,
  uid: string,
  draft: SendDraft,
  userDetails: MessageRowUserDetails | null
): MessageItem => ({
  kind: 'message',
  id: clientId,
  client_id: clientId,
  seq: null,
  status: 'pending',
  row: buildOptimisticMessageRow(clientId, channelId, uid, draft, userDetails)
})

export type UseSendMessageArgs = {
  channelId: string
  listRef: React.MutableRefObject<VirtuosoMessageListMethods<ChatItem, unknown> | null>
  dataIncludesTailRef: React.MutableRefObject<boolean>
  snapToPresent: () => Promise<void>
  onAuthRequired: () => void
  feedMode?: ChannelFeedMode
}

export const useSendMessage = ({
  channelId,
  listRef,
  dataIncludesTailRef,
  snapToPresent,
  onAuthRequired,
  feedMode = 'all'
}: UseSendMessageArgs) => {
  const readUid = () => useAuthStore.getState().profile?.id ?? null

  const send = useCallback(
    async (draft: SendDraft): Promise<SendResult> => {
      const uid = readUid()
      if (!uid) {
        onAuthRequired()
        return 'auth_required'
      }
      if (!dataIncludesTailRef.current) await snapToPresent()

      const clientId = generateClientMessageId()
      const html = draft.html ?? null
      const medias = Array.isArray(draft.medias) ? draft.medias : null
      const userDetails = profileToMessageRowUserDetails(useAuthStore.getState().profile, uid)

      const optimistic = buildOptimisticMessageItem(clientId, channelId, uid, draft, userDetails)

      if (showOptimisticMessageInFeed(feedMode, draft.medias ?? null)) {
        listRef.current?.data.append([optimistic], () => 'smooth')
      }

      const result = await persistChatMessage({
        id: clientId,
        channel_id: channelId,
        user_id: uid,
        content: draft.content,
        html,
        reply_to_message_id: draft.reply_to_message_id ?? null,
        medias,
        type: draft.type ?? null,
        storageVerified: draft.storageVerified
      })

      if (result.ok) {
        if (result.duplicate) {
          listRef.current?.data.map((i) =>
            isMessage(i) && i.client_id === clientId
              ? { ...(i as MessageItem), status: 'sent' as const }
              : i
          )
        }
        return 'sent'
      }

      listRef.current?.data.map((i) =>
        isMessage(i) && i.client_id === clientId
          ? {
              ...(i as MessageItem),
              status: 'failed' as const,
              row: { ...(i as MessageItem).row, statusError: result.error }
            }
          : i
      )
      return 'failed'
    },
    [channelId, listRef, dataIncludesTailRef, snapToPresent, onAuthRequired, feedMode]
  )

  const retry = useCallback(
    async (clientId: string) => {
      const uid = readUid()
      if (!uid) {
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
      const result = await retryChatMessage(
        {
          id: clientId,
          channel_id: channelId,
          content: row.content ?? '',
          html: row.html ?? null,
          reply_to_message_id: row.reply_to_message_id ?? null,
          medias: row.medias ?? null,
          type: row.type ?? null
        },
        uid
      )
      listRef.current?.data.map((i) =>
        isMessage(i) && i.client_id === clientId
          ? {
              ...(i as MessageItem),
              status: result.ok ? ('sent' as const) : ('failed' as const),
              row: {
                ...(i as MessageItem).row,
                statusError: result.ok ? undefined : result.error
              }
            }
          : i
      )
    },
    [channelId, listRef, onAuthRequired]
  )

  return { send, retry }
}
