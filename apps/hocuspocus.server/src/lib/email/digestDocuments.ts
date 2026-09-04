/**
 * Pure digest shaping, with no Redis or BullMQ in the import graph. It lives
 * apart from `pgmqConsumer.ts` because that file imports `./queue`, which opens
 * a Redis socket at module scope, so a unit test could not import it.
 */
import type {
  DigestChannel,
  DigestContentChanges,
  DigestDocument,
  DigestNotification,
  NotificationType
} from '../../types/email.types'

/** notification_category value written by notify_document_content_change. */
export const CONTENT_CHANGE_TYPE = 'content_change'

/** Raw notification data from SQL compile_digest_emails */
export interface DigestRawNotification {
  notification_type: string
  sender_name: string
  sender_avatar_url: string | null
  message_preview: string
  channel_id: string | null
  channel_name: string
  workspace_id: string | null
  workspace_name: string
  workspace_slug: string
  created_at: string
}

/**
 * A content_change carrier is a document-level fact, not a chat line, so it
 * seeds the block and never enters the channel map. Exported for unit tests.
 */
export function buildDigestDocuments(
  notifications: DigestRawNotification[],
  appUrl: string
): DigestDocument[] {
  const workspaceMap = new Map<
    string,
    {
      name: string
      slug: string
      contentChanges?: DigestContentChanges
      channels: Map<string, { name: string; id: string; notifications: DigestNotification[] }>
    }
  >()

  for (const n of notifications) {
    const wsKey = n.workspace_slug || 'unknown'

    if (!workspaceMap.has(wsKey)) {
      workspaceMap.set(wsKey, {
        name: n.workspace_name || wsKey,
        slug: n.workspace_slug || wsKey,
        channels: new Map()
      })
    }

    const ws = workspaceMap.get(wsKey)!

    if (n.notification_type === CONTENT_CHANGE_TYPE) {
      // workspace_slug is lower(documentId); only channel_id keeps the real case.
      const documentId = n.channel_id || n.workspace_id || ''
      // Parse, not string compare: carrier timestamps can differ in fractional
      // digits or offset. An unparseable value loses on either side, so a bad
      // incoming row cannot overwrite a good earliest one.
      const since = ws.contentChanges?.since
      const incoming = Date.parse(n.created_at)
      const prior = since ? Date.parse(since) : NaN
      const keepPrior = !Number.isNaN(prior) && (Number.isNaN(incoming) || prior <= incoming)
      ws.contentChanges = {
        document_id: documentId,
        since: keepPrior ? since! : n.created_at
      }
      continue
    }

    const chKey = n.channel_id || 'general'

    if (!ws.channels.has(chKey)) {
      ws.channels.set(chKey, {
        name: n.channel_name || 'General',
        id: n.channel_id || '',
        notifications: []
      })
    }

    ws.channels.get(chKey)!.notifications.push({
      type: n.notification_type as NotificationType,
      sender_name: n.sender_name,
      sender_avatar_url: n.sender_avatar_url || undefined,
      message_preview: n.message_preview,
      action_url: n.channel_id
        ? `${appUrl}/${n.workspace_slug}?chatroom=${n.channel_id}`
        : `${appUrl}/${n.workspace_slug}`,
      created_at: n.created_at
    })
  }

  return Array.from(workspaceMap.values()).map((ws) => ({
    name: ws.name,
    slug: ws.slug,
    url: `${appUrl}/${ws.slug}`,
    channels: Array.from(ws.channels.values()).map((ch): DigestChannel => ({
      name: ch.name,
      id: ch.id,
      url: ch.id ? `${appUrl}/${ws.slug}?chatroom=${ch.id}` : `${appUrl}/${ws.slug}`,
      notifications: ch.notifications
    })),
    ...(ws.contentChanges ? { content_changes: ws.contentChanges } : {})
  }))
}

/** The payload frequency is the user's preference, not the queue type. */
export function normaliseDigestFrequency(raw: string | undefined): 'daily' | 'weekly' {
  return raw === 'weekly' ? 'weekly' : 'daily'
}

function withoutContentChanges(doc: DigestDocument): DigestDocument {
  if (!doc.content_changes) return doc
  return { name: doc.name, slug: doc.slug, url: doc.url, channels: doc.channels }
}

/**
 * Drops a content_changes block this recipient may no longer see, then drops a
 * document entry left with neither a block nor a real chat line.
 */
export function filterDigestDocuments(
  documents: DigestDocument[],
  visible: Set<string>
): DigestDocument[] {
  const kept: DigestDocument[] = []
  for (const doc of documents) {
    const next =
      doc.content_changes && visible.has(doc.content_changes.document_id)
        ? doc
        : withoutContentChanges(doc)
    const hasChat = next.channels.some((ch) => ch.notifications.length > 0)
    if (hasChat || next.content_changes) kept.push(next)
  }
  return kept
}
