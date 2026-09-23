/**
 * The push click link for a chat row. SQL cannot build it: `workspaces.slug` is
 * `lower(documentId)`, and the human slug lives only in Prisma. This module
 * lives apart from `pgmqConsumer.ts`, which opens Redis at import through `./queue`.
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
  action_url: string
  channel_id: string | null
}

/** Same query names the client reads: `chatroom` and `msg_id`. */
export function buildChatActionUrl(
  appUrl: string,
  slug: string,
  channelId: string,
  messageId: string | null
): string {
  const url = `${appUrl}/${encodeURIComponent(slug)}?chatroom=${encodeURIComponent(channelId)}`
  return messageId ? `${url}&msg_id=${encodeURIComponent(messageId)}` : url
}

/**
 * Returns the row's own link when it has one. With no metadata row it keeps the
 * empty link, so the worker opens `/`. It never falls back to `workspace_slug`,
 * because a link to the lowercased id mints a junk draft pad.
 */
export async function resolveChatActionUrl(
  payload: ChatPushFields,
  appUrl: string,
  lookups: ChatActionUrlLookups
): Promise<string> {
  if (payload.action_url || !payload.channel_id || !payload.notification_id) {
    return payload.action_url
  }

  const row = await lookups.readNotification(payload.notification_id)
  if (!row?.documentId) return payload.action_url

  const slug = await lookups.readSlug(row.documentId)
  if (!slug) return payload.action_url

  return buildChatActionUrl(appUrl, slug, payload.channel_id, row.messageId)
}
