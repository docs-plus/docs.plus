/**
 * The decisions one digest message makes: who may see each document, what a
 * Last-left stamp means, and whether the message sends, defers or is empty. It
 * lives apart from `pgmqConsumer.ts` for the same reason `digestDocuments.ts`
 * does — that file imports `./queue`, which opens Redis at module scope.
 */
import type { DigestDocument } from '../../types/email.types'
import { type ContentChangeMetadata, resolveContentChangeAudience } from '../contentChangeAudience'
import type { DigestDocumentMeta } from './digestContentChanges'
import { filterDigestDocuments } from './digestDocuments'

/** The columns both gates read. One row answers the rename and the block. */
export interface DigestMetadataRow extends ContentChangeMetadata {
  documentId: string
  title: string | null
  slug: string
}

/**
 * The rename writes a human title over the raw id, so it runs behind the same
 * audience rule as the block. Without this a reader holding an old chat line
 * would learn the title of a document that has since turned private.
 */
export function visibleDigestDocuments(
  rows: DigestMetadataRow[],
  recipientId: string
): Map<string, DigestDocumentMeta> {
  const visible = new Map<string, DigestDocumentMeta>()
  for (const row of rows) {
    const audience = resolveContentChangeAudience(row)
    const maySee =
      audience.kind === 'all' || (audience.kind === 'owner' && audience.onlyUser === recipientId)
    if (maySee) visible.set(row.documentId, { title: row.title, slug: row.slug })
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

export interface DigestOutcomeInput {
  /** Documents as the carrier rows built them, before any enrichment. */
  built: DigestDocument[]
  /** The same documents after enrichment, or `built` again when it failed. */
  enriched: DigestDocument[]
  /** documentIds this recipient may see, from `visibleDigestDocuments`. */
  visible: Set<string>
  /** The privacy re-read threw, so no answer exists for a block. */
  metaReadFailed: boolean
}

export function decideDigestOutcome(input: DigestOutcomeInput): DigestOutcome {
  const documents = filterDigestDocuments(input.enriched, input.visible)

  // Only a message carrying a block asks a privacy question, and only that
  // message may defer. The id list covers every chat document too, so a bare
  // `metaReadFailed` would hold a chat-only digest back for no reason.
  const readFailed = input.metaReadFailed && input.built.some((doc) => doc.content_changes)

  // Ahead of the empty arm, and that order is the rule. A failed re-read strips
  // every block, so a content-only digest lands here reading empty. Acking it
  // marks the carriers read, and the 24-hour dedupe then eats the next fan-out.
  if (readFailed) return { kind: 'defer' }

  // A genuinely empty digest is an answer. The caller marks it and acks, or pgmq
  // redelivers the same empty digest forever.
  if (documents.length === 0) return { kind: 'skip' }

  return { kind: 'send', documents }
}
