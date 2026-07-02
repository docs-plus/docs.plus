import { sendMessage } from '@api'
import {
  ensureChatMediaInsertReady,
  isChatMediaObjectNotFoundError
} from '@components/chatroom/utils/chatMediaStorageReadiness'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import { isDuplicateKeyError } from '@components/chatroom/utils/postgresErrors'
import type { MessageMediaItem, TMsgRow } from '@types'
import type { Database, Json } from '@types'
import { captureUnknown } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'

const captureSendFailure = (error: unknown) =>
  captureUnknown(error, {
    tags: { surface: 'chat-send', pgCode: (error as { code?: string } | null)?.code }
  })

export type ChatMessageInsertPayload = {
  id: string
  channel_id: string
  user_id: string
  content: string
  html: string | null
  reply_to_message_id?: string | null
  medias?: MessageMediaItem[] | null
  type?: Database['public']['Enums']['message_type'] | null
  storageVerified?: true
}

export type PersistChatMessageResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; error: string }

export type RetryChatMessageInput = Pick<
  TMsgRow,
  'id' | 'channel_id' | 'content' | 'html' | 'reply_to_message_id' | 'medias' | 'type'
>

type MessageInsert = Database['public']['Tables']['messages']['Insert']

const insertPayload = (payload: ChatMessageInsertPayload): MessageInsert => {
  const medias = Array.isArray(payload.medias) ? payload.medias : null
  return {
    id: payload.id,
    channel_id: payload.channel_id,
    user_id: payload.user_id,
    content: payload.content,
    html: payload.html,
    reply_to_message_id: payload.reply_to_message_id ?? null,
    ...(medias != null && medias.length > 0 ? { medias: medias as unknown as Json } : {}),
    ...(payload.type != null ? { type: payload.type } : {})
  }
}

const ensureMediaStorageReady = async (
  medias: MessageMediaItem[],
  storageVerified?: true
): Promise<PersistChatMessageResult | null> => {
  if (medias.length === 0 || storageVerified) return null
  if (await ensureChatMediaInsertReady(medias)) return null
  return { ok: false, error: 'Attachments are not available in storage yet' }
}

/** Direct insert — canonical first-send path (AGENTS.md §Optimistic Message Lifecycle). */
export async function persistChatMessage(
  payload: ChatMessageInsertPayload
): Promise<PersistChatMessageResult> {
  const notReady = await ensureMediaStorageReady(
    parseMessageMedias(payload.medias),
    payload.storageVerified
  )
  if (notReady) return notReady

  try {
    const { error } = await supabaseClient.from('messages').insert(insertPayload(payload))
    if (error) {
      if (isDuplicateKeyError(error)) return { ok: true, duplicate: true }
      captureSendFailure(error)
      const message = typeof error.message === 'string' ? error.message : 'Failed to send'
      return { ok: false, error: message }
    }
    return { ok: true }
  } catch (error: unknown) {
    captureSendFailure(error)
    const message = error instanceof Error ? error.message : 'Failed to send'
    return { ok: false, error: message }
  }
}

const issueSendViaApi = async (row: RetryChatMessageInput, profileId: string) => {
  await sendMessage({
    id: row.id,
    content: row.content ?? '',
    channel_id: row.channel_id,
    user_id: profileId,
    html: row.html ?? null,
    reply_to_message_id: row.reply_to_message_id ?? null,
    medias: row.medias ?? null,
    type: row.type ?? null
  })
}

/** Re-issue with the original client UUID; treats Postgres 23505 as success. */
export async function retryChatMessage(
  row: RetryChatMessageInput,
  profileId: string
): Promise<PersistChatMessageResult> {
  const medias = parseMessageMedias(row.medias)
  const notReady = await ensureMediaStorageReady(medias)
  if (notReady) return notReady

  try {
    await issueSendViaApi(row, profileId)
    return { ok: true }
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) return { ok: true, duplicate: true }

    if (isChatMediaObjectNotFoundError(error) && medias.length > 0) {
      const storageReady = await ensureChatMediaInsertReady(medias, {
        maxAttempts: 8,
        delayMs: 200
      })
      if (storageReady) {
        try {
          await issueSendViaApi(row, profileId)
          return { ok: true }
        } catch (retryError: unknown) {
          if (isDuplicateKeyError(retryError)) return { ok: true, duplicate: true }
          captureSendFailure(retryError)
          const message = retryError instanceof Error ? retryError.message : 'Failed to send'
          return { ok: false, error: message }
        }
      }
    }

    captureSendFailure(error)
    const message = error instanceof Error ? error.message : 'Failed to send'
    return { ok: false, error: message }
  }
}
