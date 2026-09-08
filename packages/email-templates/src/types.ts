/**
 * One declaration of the digest payload. The renderer, `countDigestItems` and
 * the backend all read this file. So a field can no longer reach a template
 * while missing from the type that renders it.
 */

export type DigestFrequency = 'daily' | 'weekly'

/**
 * Mirrors Supabase `notifications.type`. It is declared here because the
 * renderer owns it: `getEmailSubject` and `notificationIcon` switch on exactly
 * these names, so a typo in a payload must fail here rather than print
 * "New notification" to a reader.
 */
export type NotificationType =
  | 'mention'
  | 'reply'
  | 'reaction'
  | 'message'
  | 'thread_message'
  | 'channel_event'
  | 'content_change'

export interface DigestNotification {
  type: NotificationType
  sender_name: string
  sender_avatar_url?: string
  message_preview: string
  action_url: string
  created_at: string
}

export interface DigestChannel {
  name: string
  id: string
  url: string
  notifications: DigestNotification[]
}

export interface DigestChangedSection {
  /** Heading text. Compute already sanitised and capped it. */
  text: string
  /** The two deepest ancestor headings, outermost first. Empty at the root. */
  breadcrumb: string[]
  /** `${docUrl}?id=<tocId>`, or docUrl for the root and for a removed section. */
  url: string
}

/**
 * The consumer seeds document_id and since; enrichment adds the sections. A
 * failed enrichment leaves the seed, so both halves stay optional.
 */
export interface DigestContentChanges {
  /** Exact-case documentId, taken from the carrier's channel_id. */
  document_id: string
  /** Earliest carrier time, or the resolved window start after enrichment. */
  since: string
  /**
   * True only when `since` is the reader's Last left, so the email never says
   * "since you left" to a reader who never left. The carrier seed is false.
   */
  fromLastLeft: boolean
  /** Changed sections in document order, capped by the enrichment. */
  sections?: DigestChangedSection[]
  /** Sections the cap cut. Absent when nothing was cut. */
  moreCount?: number
  /** People named in the window. A floor, never a census. Absent when none resolved. */
  contributorCount?: number
}

export interface DigestDocument {
  name: string
  slug: string
  url: string
  /** Exact-case documentId. Absent only for the synthetic `unknown` bucket. */
  workspace_id?: string
  channels: DigestChannel[]
  /** Absent on every legacy payload; only a content_change carrier seeds it. */
  content_changes?: DigestContentChanges
}
