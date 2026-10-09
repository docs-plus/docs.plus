/**
 * Digest enrichment: the reader's window, the changed-section list, and the
 * human name behind a 19-character documentId. It lives apart from
 * `pgmqConsumer.ts` for the same reason `digestDocuments.ts` does — that file
 * imports `./queue`, which opens a Redis socket at module scope.
 */
import type { Logger } from 'pino'

import type { ComputeDocumentChanges, SectionNode } from '../../modules/document-changes/types'
import type { DigestChangedSection, DigestDocument } from '../../types/email.types'
import { buildChatActionUrl } from '../push/chatActionUrl'

const DAY_MS = 24 * 60 * 60 * 1000

/** The two human fields behind a documentId. `workspaces` holds neither. */
export interface DigestDocumentMeta {
  title: string | null
  slug: string
}

export type ReadDigestMetadata = (documentId: string) => Promise<DigestDocumentMeta | null>

/** Last left for every document in one digest. A missing id means no visit. */
export type ReadDigestLastVisits = (
  recipientId: string,
  documentIds: string[]
) => Promise<Map<string, Date | null>>

/**
 * Collaborators arrive as arguments, so this module imports no Prisma client,
 * no Supabase client and no queue, and a unit test can pass a throwing compute.
 */
export interface EnrichDigestOptions {
  computeChanges: ComputeDocumentChanges
  readMetadata: ReadDigestMetadata
  readLastVisits: ReadDigestLastVisits
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
 * One walk, so every Section keeps its document place. A heading chat moves
 * only under a live heading; a removed heading's chat keeps its channel row.
 * Chats match by heading_id, because a new channel's id is not its toc-id (#402).
 * A nameless changed row is kept, because a changed heading is never dropped.
 * It links to the document, and `walkDigest` names it.
 */
function placeSections(
  tree: SectionNode[],
  doc: DigestDocument
): { sections: DigestChangedSection[]; channels: DigestDocument['channels'] } {
  const headingOf = (channel: DigestDocument['channels'][number]): string =>
    channel.heading_id || channel.id
  const pending = new Map(
    doc.channels.filter((channel) => channel.id).map((channel) => [headingOf(channel), channel])
  )
  const sections: DigestChangedSection[] = []

  const walk = (nodes: SectionNode[]): void => {
    for (const node of nodes) {
      // A removed section's anchor resolves to nothing, so this links to
      // the document rather than offering a link that goes nowhere.
      const live = node.status !== 'removed' && node.text.length > 0 ? node.tocId : null
      const chats = live ? (pending.get(live)?.notifications ?? []) : []
      if (live && chats.length > 0) pending.delete(live)
      const changed = node.status !== 'unchanged'
      if (changed || chats.length > 0) {
        sections.push({
          text: node.text,
          url: sectionUrl(doc.url, live),
          status: node.status,
          ...(node.previousLevel !== undefined ? { previousLevel: node.previousLevel } : {}),
          ...(live ? { tocId: live } : {}),
          ...(node.runs?.length ? { runs: node.runs } : {}),
          ...(chats.length > 0 ? { chats } : {})
        })
      }
      walk(node.children)
    }
  }

  walk(tree)
  return {
    sections,
    channels: doc.channels.filter((channel) => !channel.id || pending.has(headingOf(channel)))
  }
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
      const channelUrl = channel.id
        ? buildChatActionUrl(meta.slug, channel.id, { origin: appUrl })
        : url
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
  options: EnrichDigestOptions,
  lastVisit: Date | null
): Promise<DigestDocument> {
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

  const placed = placeSections(outcome.result.sections ?? [], doc)
  if (placed.sections.length === 0) return doc

  // A floor, never a census: a service-role write carries no person, and a failed
  // profile lookup resolves to none. So 0 is a real answer and stays absent, and
  // the renderer never says "0 people".
  const contributorCount = outcome.result.summary.contributors.length
  return {
    ...doc,
    channels: placed.channels,
    content_changes: {
      document_id: documentId,
      // Overwritten on the success path only, so the "changed since" line and the
      // rows beneath it describe one window.
      since: since.toISOString(),
      // Explicit false, never an omitted key: absent means enrichment never ran,
      // and the renderer must not read that as the frequency fallback.
      // The retention floor can clamp the start past Last left. The words "since you
      // left" would then name a date months after the real one, so the clamp wins.
      fromLastLeft: lastVisit !== null && since.getTime() === lastVisit.getTime(),
      sections: placed.sections,
      ...(contributorCount > 0 ? { contributorCount } : {})
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
  const ids = documents.flatMap((doc) => (doc.workspace_id ? [doc.workspace_id] : []))
  const visits = await options.readLastVisits(options.recipientId, ids)
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
        current.content_changes
          ? await withSections(current, documentId, options, visits.get(documentId) ?? null)
          : current
      )
    } catch (err) {
      options.logger.warn({ err, documentId }, 'Digest change enrichment failed')
      enriched.push(current)
    }
  }

  return enriched
}
