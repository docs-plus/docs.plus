/**
 * The chat link for a push click and an immediate email. SQL cannot build it:
 * `workspaces.slug` is `lower(documentId)`, and the human slug lives only in Prisma.
 * This module imports no client, so a unit test can load it without Redis.
 */
import { openableSlug, padLink, type PadLinkRow } from './padLink'

/** Where a chat message lives. `documentId` is `channels.workspace_id`, the exact-case id. */
export interface ChatSource {
  documentId: string | null
  messageId: string | null
}

export interface ChatLinkLookups {
  /** Runs only when the payload does not name the document. Null when the row is gone. */
  readSource: () => Promise<ChatSource | null>
  /** Null when the document has no metadata row. */
  readPadRow: (documentId: string) => Promise<PadLinkRow | null>
}

interface KnownChat {
  channelId: string | null
  documentId?: string | null
  messageId?: string | null
}

/** Document, then pad row. Null when no document is found. */
async function findChat(chat: KnownChat, lookups: ChatLinkLookups) {
  const source = chat.documentId
    ? { documentId: chat.documentId, messageId: null }
    : chat.channelId
      ? await lookups.readSource()
      : null
  if (!source?.documentId) return null
  return {
    row: await lookups.readPadRow(source.documentId),
    messageId: (chat.messageId || source.messageId) ?? undefined
  }
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
 * No reader gate: the maintainer's leave-out rule covers mail only.
 */
async function forPush(payload: ChatPushFields, lookups: ChatLinkLookups): Promise<string> {
  if (
    !CHAT_NOTIFICATION_TYPES.has(payload.type) ||
    payload.action_url ||
    !payload.channel_id ||
    !payload.notification_id
  ) {
    return payload.action_url
  }

  const chat = await findChat({ channelId: payload.channel_id }, lookups)
  if (!chat?.row?.slug) return payload.action_url

  return padLink(chat.row.slug, {
    kind: 'chat',
    linkId: payload.channel_id,
    messageId: chat.messageId
  })
}

/** The immediate email's fields. `workspace_id` and `message_id` are absent on a row queued before #647. */
export interface ChatEmailFields {
  recipient_id: string
  channel_id?: string | null
  workspace_id?: string | null
  message_id?: string | null
}

/**
 * `link` when the reader can open the pad; `leave-out` when they cannot, so the mail
 * is skipped. A row that names no channel and no document opens Home on purpose,
 * never `?chatroom=` on Home, which opens no chat. A lookup that throws defers the message.
 */
async function forEmail(
  fields: ChatEmailFields,
  lookups: ChatLinkLookups,
  appUrl: string
): Promise<{ kind: 'link'; url: string } | { kind: 'leave-out' }> {
  const channelId = fields.channel_id || null
  const chat = await findChat(
    { channelId, documentId: fields.workspace_id, messageId: fields.message_id },
    lookups
  )
  if (!chat) {
    return channelId ? { kind: 'leave-out' } : { kind: 'link', url: `${appUrl}/` }
  }

  const slug = openableSlug(chat.row, fields.recipient_id)
  if (!slug) return { kind: 'leave-out' }

  const url = channelId
    ? padLink(slug, { kind: 'chat', linkId: channelId, messageId: chat.messageId }, appUrl)
    : padLink(slug, { kind: 'document' }, appUrl)
  return { kind: 'link', url }
}

/** One lookup shape. Push links any pad it finds; email leaves out a pad its reader cannot open. */
export const chatLink = { forPush, forEmail }
