/**
 * Pure digest shaping, with no Redis or BullMQ in the import graph. It lives
 * apart from `pgmqConsumer.ts` because that file imports `./queue`, which opens
 * a Redis socket at module scope, so a unit test could not import it.
 */
import type {
  DigestChannel,
  DigestContentChanges,
  DigestDocument,
  NotificationType
} from '../../types/email.types'
import { padLink } from '../padLink'
import { sanitizePlainText } from '../sanitizePlainText'
import type { DigestDocumentMeta } from './digestContentChanges'

/** notification_category value written by notify_document_content_change. */
export const CONTENT_CHANGE_TYPE = 'content_change'

/**
 * Raw notification data from SQL compile_digest_emails. It also carries `workspace_name`
 * and `workspace_slug`, left untyped on purpose: both hold the raw or lowercased id.
 */
export interface DigestRawNotification {
  notification_type: string
  sender_name: string
  sender_avatar_url: string | null
  message_preview: string
  channel_id: string | null
  /** Absent on a message queued before #402. */
  heading_id?: string | null
  channel_name: string
  /** `channels.workspace_id`, the exact-case documentId; null when the channel row is gone. */
  workspace_id: string | null
  created_at: string
}

/** A heading channel's id is not the documentId (#402); a carrier's channel id is. */
export function digestDocumentId(n: DigestRawNotification): string | null {
  return n.notification_type === CONTENT_CHANGE_TYPE
    ? n.channel_id || n.workspace_id
    : n.workspace_id
}

/**
 * Leaves out every document the reader cannot open: `visible` holds only those, from
 * `visibleDigestDocuments`. Links use the pad slug, never `workspace_slug`, which is a
 * lowercased id that mints a junk draft pad. A carrier seeds the block, never a chat line.
 */
export function buildDigestDocuments(
  notifications: DigestRawNotification[],
  visible: Map<string, DigestDocumentMeta>,
  appUrl: string
): DigestDocument[] {
  const documents = new Map<
    string,
    {
      meta: DigestDocumentMeta
      contentChanges?: DigestContentChanges
      channels: Map<string, Omit<DigestChannel, 'url'>>
    }
  >()

  for (const n of notifications) {
    const documentId = digestDocumentId(n)
    const meta = documentId ? visible.get(documentId) : undefined
    if (!documentId || !meta) continue

    if (!documents.has(documentId)) documents.set(documentId, { meta, channels: new Map() })
    const doc = documents.get(documentId)!

    if (n.notification_type === CONTENT_CHANGE_TYPE) {
      // Parse, not string compare: carrier timestamps can differ in fractional
      // digits or offset. An unparseable value loses on either side, so a bad
      // incoming row cannot overwrite a good earliest one.
      const since = doc.contentChanges?.since
      const incoming = Date.parse(n.created_at)
      const prior = since ? Date.parse(since) : NaN
      const keepPrior = !Number.isNaN(prior) && (Number.isNaN(incoming) || prior <= incoming)
      doc.contentChanges = {
        document_id: documentId,
        // A carrier time is not a Last left, so the email must not say "since you left".
        fromLastLeft: false,
        since: keepPrior ? since! : n.created_at
      }
      continue
    }

    const chKey = n.channel_id || 'general'

    if (!doc.channels.has(chKey)) {
      doc.channels.set(chKey, {
        name: n.channel_name || 'General',
        id: n.channel_id || '',
        heading_id: n.heading_id || undefined,
        notifications: []
      })
    }

    doc.channels.get(chKey)!.notifications.push({
      type: n.notification_type as NotificationType,
      sender_name: n.sender_name,
      sender_avatar_url: n.sender_avatar_url || undefined,
      message_preview: sanitizePlainText(n.message_preview, 200),
      action_url: '',
      created_at: n.created_at
    })
  }

  return Array.from(documents.entries()).map(([documentId, doc]) => {
    const { slug } = doc.meta
    const url = padLink({ kind: 'document', slug }, appUrl)
    return {
      // A blank title is the same failure as the raw id, so it falls through to the slug.
      name: doc.meta.title?.trim() || slug,
      slug,
      url,
      workspace_id: documentId,
      channels: Array.from(doc.channels.values()).map((ch): DigestChannel => {
        const channelUrl = ch.id ? padLink({ kind: 'chat', slug, linkId: ch.id }, appUrl) : url
        return {
          ...ch,
          url: channelUrl,
          notifications: ch.notifications.map((item) => ({ ...item, action_url: channelUrl }))
        }
      }),
      ...(doc.contentChanges ? { content_changes: doc.contentChanges } : {})
    }
  })
}

export type DigestGrouping = 'document' | 'aggregate'

/** One mail per document, unless an admin has chosen a single combined mail. */
export function groupDigestDocuments(
  documents: DigestDocument[],
  grouping: DigestGrouping
): DigestDocument[][] {
  if (grouping === 'aggregate' || documents.length <= 1) return [documents]
  return documents.map((document) => [document])
}

/** The payload frequency is the user's preference, not the queue type. */
export function normaliseDigestFrequency(raw: string | undefined): 'daily' | 'weekly' {
  return raw === 'weekly' ? 'weekly' : 'daily'
}
