/**
 * Digest enrichment: the reader's window, the changed-section list, and the
 * human name behind a 19-character documentId. It lives apart from
 * `pgmqConsumer.ts` for the same reason `digestDocuments.ts` does — that file
 * imports `./queue`, which opens a Redis socket at module scope.
 */
import type { Logger } from 'pino'

import type { ComputeDocumentChanges, SectionNode } from '../../modules/document-changes/types'
import type { DigestChangedSection, DigestDocument } from '../../types/email.types'

const DAY_MS = 24 * 60 * 60 * 1000

/** Eight rows fill the email card; the rest becomes one "+N more" line. */
export const MAX_DIGEST_SECTIONS = 8

/** The two human fields behind a documentId. `workspaces` holds neither. */
export interface DigestDocumentMeta {
  title: string | null
  slug: string
}

export type ReadDigestMetadata = (documentId: string) => Promise<DigestDocumentMeta | null>

/** The roster's own rule: `coalesce(updated_at, created_at)` on the membership row. */
export type ReadDigestLastVisit = (recipientId: string, documentId: string) => Promise<Date | null>

/**
 * Collaborators arrive as arguments, so this module imports no Prisma client,
 * no Supabase client and no queue, and a unit test can pass a throwing compute.
 */
export interface EnrichDigestOptions {
  computeChanges: ComputeDocumentChanges
  readMetadata: ReadDigestMetadata
  readLastVisit: ReadDigestLastVisit
  logger: Logger
  recipientId: string
  frequency: 'daily' | 'weekly'
  now: Date
  retentionDays: number
  appUrl: string
}

/**
 * A reader with no last visit is common, not exceptional: the owner branch of
 * `notify_document_content_change` reaches owners who never joined. The floor
 * bounds a stale reader, because a `since` older than every surviving row makes
 * the whole document read as added.
 */
export function resolveDigestSince(
  lastVisit: Date | null,
  frequency: 'daily' | 'weekly',
  now: Date,
  retentionDays: number
): Date {
  const window = frequency === 'weekly' ? 7 * DAY_MS : DAY_MS
  const start = lastVisit ? lastVisit.getTime() : now.getTime() - window
  // 0 disables pruning entirely (env.schema.ts), so there is no floor to clamp to.
  const floor =
    retentionDays > 0 ? now.getTime() - retentionDays * DAY_MS : Number.NEGATIVE_INFINITY
  // A clock-skewed future visit would give compute a baseline newer than its own
  // head, so the window never starts after it ends.
  return new Date(Math.min(Math.max(start, floor), now.getTime()))
}

/** `tocId` is stranger-written on a public document, so it is never raw in a URL. */
function sectionUrl(docUrl: string, tocId: string | null): string {
  return tocId ? `${docUrl}?id=${encodeURIComponent(tocId)}` : docUrl
}

/**
 * Depth-first, document order. An `unchanged` node is dropped from the output
 * but still joins the ancestor stack, or a changed leaf under an untouched
 * heading would lose its breadcrumb.
 */
export function flattenChangedSections(
  tree: SectionNode[],
  docUrl: string
): DigestChangedSection[] {
  const rows: DigestChangedSection[] = []
  const ancestors: string[] = []

  const walk = (nodes: SectionNode[]): void => {
    for (const node of nodes) {
      // A nameless row is a live link with no label, and it would spend one of
      // the eight slots. The preamble and an untyped new heading both sanitise
      // to ''. The document-level line already says the document changed.
      if (node.status !== 'unchanged' && node.text.length > 0) {
        rows.push({
          text: node.text,
          breadcrumb: ancestors.filter((text) => text.length > 0).slice(-2),
          // A removed section's anchor resolves to nothing, so this links to
          // the document rather than offering a link that goes nowhere.
          url: node.status === 'removed' ? docUrl : sectionUrl(docUrl, node.tocId)
        })
      }
      ancestors.push(node.text)
      walk(node.children)
      ancestors.pop()
    }
  }

  walk(tree)
  return rows
}

/**
 * `workspaces.name` is the raw documentId and `workspaces.slug` its lowercased
 * copy, so every link built from them mints a junk draft. A blank title is the
 * same failure as the raw id, so it falls through to the slug too.
 */
function withResolvedName(
  doc: DigestDocument,
  meta: DigestDocumentMeta,
  appUrl: string
): DigestDocument {
  const url = `${appUrl}/${meta.slug}`
  return {
    ...doc,
    name: meta.title?.trim() || meta.slug,
    slug: meta.slug,
    url,
    channels: doc.channels.map((channel) => {
      const channelUrl = channel.id ? `${url}?chatroom=${channel.id}` : url
      return {
        ...channel,
        url: channelUrl,
        notifications: channel.notifications.map((n) => ({ ...n, action_url: channelUrl }))
      }
    })
  }
}

async function withSections(
  doc: DigestDocument,
  documentId: string,
  options: EnrichDigestOptions
): Promise<DigestDocument> {
  const lastVisit = await options.readLastVisit(options.recipientId, documentId)
  const since = resolveDigestSince(lastVisit, options.frequency, options.now, options.retentionDays)
  const outcome = await options.computeChanges({
    documentId,
    since,
    until: options.now,
    scope: 'headings'
  })

  if (!outcome.ok) {
    options.logger.warn({ documentId, reason: outcome.reason }, 'Digest change compute refused')
    return doc
  }

  // `changed` is the summary's own answer. Dropping the block here is what stops
  // a card whose body reads "0 sections changed".
  if (!outcome.result.changed) {
    const { content_changes, ...rest } = doc
    return rest
  }

  const rows = flattenChangedSections(outcome.result.sections ?? [], doc.url)
  if (rows.length === 0) return doc

  const more = rows.length - MAX_DIGEST_SECTIONS
  return {
    ...doc,
    content_changes: {
      document_id: documentId,
      // Overwritten on the success path only, so the "changed since" line and the
      // rows beneath it describe one window.
      since: since.toISOString(),
      sections: rows.slice(0, MAX_DIGEST_SECTIONS),
      ...(more > 0 ? { moreCount: more } : {})
    }
  }
}

/**
 * Compute runs only where a carrier already seeded a block, so this step is safe
 * on either side of the privacy re-read and cannot defeat
 * `content_email_muted_at`. An invented block would break both.
 */
export async function enrichDigestDocuments(
  documents: DigestDocument[],
  options: EnrichDigestOptions
): Promise<DigestDocument[]> {
  const enriched: DigestDocument[] = []

  // Serial on purpose: a loaded room costs 16.5-17x its stored snapshot in heap,
  // and the profile read inside compute makes the loop I/O-bound anyway.
  for (const doc of documents) {
    const documentId = doc.workspace_id
    // Two left joins in the digest SQL leave this null, and that row is the
    // synthetic `unknown` bucket. It names no document, so nothing to look up.
    if (!documentId) {
      enriched.push(doc)
      continue
    }

    // Per-document, so one bad snapshot costs its own block and not the digest.
    // A section list is decoration, not the answer to a privacy question, so a
    // failure logs and omits the detail; it never defers the message.
    let current = doc
    try {
      const meta = await options.readMetadata(documentId)
      // No metadata row means no human slug, and a section link built from the
      // 19-character id is the failure this whole step exists to prevent.
      if (!meta) {
        enriched.push(current)
        continue
      }
      current = withResolvedName(current, meta, options.appUrl)
      enriched.push(
        current.content_changes ? await withSections(current, documentId, options) : current
      )
    } catch (err) {
      options.logger.warn({ err, documentId }, 'Digest change enrichment failed')
      enriched.push(current)
    }
  }

  return enriched
}
