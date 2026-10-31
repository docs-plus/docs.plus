/**
 * The chat link for a push click and an immediate email. SQL cannot build it:
 * `workspaces.slug` is `lower(documentId)`, and the human slug lives only in Prisma.
 * This module imports no client, so a unit test can load it without Redis.
 */
import { openableSlug, padLink, type PadLinkRow } from '../padLink'

export interface ChatNotificationRow {
  messageId: string | null
  /** `channels.workspace_id`, which is the exact-case documentId. */
  documentId: string | null
}

/** Collaborators arrive as arguments, so a unit test needs no client and no mock. */
export interface ChatActionUrlLookups {
  readNotification: (notificationId: string) => Promise<ChatNotificationRow | null>
  /** Null when the document has no metadata row. */
  readSlug: (documentId: string) => Promise<string | null>
}

export interface ChatPushFields {
  notification_id: string
  type: string
  action_url: string
  channel_id: string | null
}

/** The types a chat message writes. SQL gives them a message and a channel, but no link. */
const CHAT_NOTIFICATION_TYPES = new Set([
  'mention',
  'reply',
  'message',
  'reaction',
  'channel_event'
])

/**
 * Returns the row's own link when it has one. With no metadata row it keeps the
 * empty link, so the service worker opens `/`. It never falls back to
 * `workspace_slug`, because a link to the lowercased id mints a junk draft pad.
 */
export async function resolveChatActionUrl(
  payload: ChatPushFields,
  lookups: ChatActionUrlLookups
): Promise<string> {
  if (
    !CHAT_NOTIFICATION_TYPES.has(payload.type) ||
    payload.action_url ||
    !payload.channel_id ||
    !payload.notification_id
  ) {
    return payload.action_url
  }

  const row = await lookups.readNotification(payload.notification_id)
  if (!row?.documentId) return payload.action_url

  const slug = await lookups.readSlug(row.documentId)
  if (!slug) return payload.action_url

  return padLink({
    kind: 'chat',
    slug,
    linkId: payload.channel_id,
    messageId: row.messageId ?? undefined
  })
}

/** The immediate email's fields. `workspace_id` and `message_id` are absent on a row queued before #647. */
export interface ChatEmailFields {
  recipient_id: string
  channel_id?: string | null
  workspace_id?: string | null
  message_id?: string | null
}

/** A lookup that throws defers the message, so pgmq redelivers it. */
export interface ChatEmailLookups {
  /** `channels.workspace_id`; null when the channel row is gone. */
  readChannelDocument: (channelId: string) => Promise<string | null>
  readPadRow: (documentId: string) => Promise<PadLinkRow | null>
}

/**
 * `link` when the reader can open the pad; `leave-out` when they cannot, so the mail
 * is skipped. A row that names no channel and no document opens Home on purpose,
 * never `?chatroom=` on Home, which opens no chat.
 */
export async function resolveChatEmailLink(
  fields: ChatEmailFields,
  lookups: ChatEmailLookups,
  appUrl: string
): Promise<{ kind: 'link'; url: string } | { kind: 'leave-out' }> {
  const channelId = fields.channel_id || null
  const documentId =
    fields.workspace_id || (channelId ? await lookups.readChannelDocument(channelId) : null)
  if (!documentId) {
    return channelId ? { kind: 'leave-out' } : { kind: 'link', url: `${appUrl}/` }
  }

  const slug = openableSlug(await lookups.readPadRow(documentId), fields.recipient_id)
  if (!slug) return { kind: 'leave-out' }

  const url = channelId
    ? padLink(
        { kind: 'chat', slug, linkId: channelId, messageId: fields.message_id || undefined },
        appUrl
      )
    : padLink({ kind: 'document', slug }, appUrl)
  return { kind: 'link', url }
}
