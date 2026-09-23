/**
 * The chat link for a push click and a digest email. SQL cannot build it:
 * `workspaces.slug` is `lower(documentId)`, and the human slug lives only in Prisma.
 * This module imports nothing, so the digest and a unit test can load it without Redis.
 */

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
 * Same query names the client reads: `chatroom` and `msg_id`. With no `origin`
 * the link is relative, and the service worker resolves it against its own scope.
 */
export function buildChatActionUrl(
  slug: string,
  channelId: string,
  { messageId = null, origin = '' }: { messageId?: string | null; origin?: string } = {}
): string {
  const url = `${origin}/${encodeURIComponent(slug)}?chatroom=${encodeURIComponent(channelId)}`
  return messageId ? `${url}&msg_id=${encodeURIComponent(messageId)}` : url
}

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

  return buildChatActionUrl(slug, payload.channel_id, { messageId: row.messageId })
}
