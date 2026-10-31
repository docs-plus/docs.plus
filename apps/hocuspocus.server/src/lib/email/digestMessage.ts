/**
 * The decisions one digest message makes: who may open each document, what a
 * Last-left stamp means, whether the message defers or is empty, and which mails
 * it sends. It lives apart from `pgmqConsumer.ts` for the same reason
 * `digestDocuments.ts` does — that file imports `./queue`, which opens Redis at module scope.
 */
import type { DigestDocument } from '../../types/email.types'
import { openableSlug, type PadLinkRow } from '../padLink'
import {
  type DigestDocumentMeta,
  type DigestGrouping,
  groupDigestDocuments,
  splitDigestQueueIds
} from './digestDocuments'

/**
 * The name, the links and the block all read this map, so a document the reader
 * cannot open leaves the digest whole. Without it a reader holding an old chat line
 * would learn the title of a document that has since turned private.
 */
export function visibleDigestDocuments(
  rows: PadLinkRow[],
  recipientId: string
): Map<string, DigestDocumentMeta> {
  const visible = new Map<string, DigestDocumentMeta>()
  for (const row of rows) {
    const slug = openableSlug(row, recipientId)
    if (slug) visible.set(row.documentId, { title: row.title, slug })
  }
  return visible
}

/**
 * A missing or unparseable stamp is no Last left, and the caller then falls back
 * to the frequency window. That widens the window rather than costing the reader
 * the block, which is the safe direction for a fact this cannot read.
 */
export function parseLastVisitStamp(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const at = new Date(raw)
  return Number.isNaN(at.getTime()) ? null : at
}

/** `defer` leaves the rows `processing` so pgmq redelivers; `skip` acks them. */
export type DigestOutcome =
  { kind: 'defer' } | { kind: 'skip' } | { kind: 'send'; documents: DigestDocument[] }

/** Needs no setting, so the defer and skip arms answer before any Redis read. */
export function decideDigestOutcome(input: {
  /** Built from `visibleDigestDocuments`, then enriched; empty when the read failed. */
  documents: DigestDocument[]
  /** The metadata read threw, so no document has a slug or an audience answer. */
  metaReadFailed: boolean
}): DigestOutcome {
  // Ahead of the empty arm, and that order is the rule. A failed read leaves every
  // document out, so the digest lands here reading empty. Acking it marks the
  // carriers read, and the 24-hour dedupe then eats the next fan-out.
  if (input.metaReadFailed) return { kind: 'defer' }

  const documents = input.documents.filter(
    (doc) => doc.content_changes || doc.channels.some((ch) => ch.notifications.length > 0)
  )

  // A genuinely empty digest is an answer. The caller marks it and acks, or pgmq
  // redelivers the same empty digest forever.
  if (documents.length === 0) return { kind: 'skip' }

  return { kind: 'send', documents }
}

/** One mail: its documents and the email_queue rows it settles. */
export interface DigestMail {
  documents: DigestDocument[]
  queueIds: string[]
}

/** The mails a `send` outcome makes. `leftOver` rows are in no mail and settle `skipped`. */
export function planDigestMails(
  documents: DigestDocument[],
  input: {
    grouping: DigestGrouping
    /** The message's whole queue id list. */
    queueIds: string[]
    /** From `buildDigestDocuments`; null when a notification has no queue id. */
    queueIdsByDocument: Map<string, string[]> | null
  }
): { mails: DigestMail[]; leftOver: string[] } {
  const groups = groupDigestDocuments(documents, input.grouping)
  const { perMail, leftOver } = splitDigestQueueIds(
    groups,
    input.queueIds,
    input.queueIdsByDocument
  )
  return {
    mails: groups.map((group, index) => ({ documents: group, queueIds: perMail[index] })),
    leftOver
  }
}
