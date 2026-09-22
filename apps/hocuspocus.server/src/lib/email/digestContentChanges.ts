/**
 * Digest enrichment: the reader's window, the changed-section list, and the
 * human name behind a 19-character documentId. It lives apart from
 * `pgmqConsumer.ts` for the same reason `digestDocuments.ts` does — that file
 * imports `./queue`, which opens a Redis socket at module scope.
 */
import type { Logger } from 'pino'

import type { ComputeDocumentChanges, SectionNode } from '../../modules/document-changes/types'
import type {
  DigestChangedSection,
  DigestDocument,
  DigestHeadingChat,
  DigestNotification
} from '../../types/email.types'

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

function chatStamp(iso: string): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return iso
  const date = new Date(at)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function headingChats(notifications: DigestNotification[]): DigestHeadingChat[] {
  return notifications.flatMap((note) => {
    const text = note.message_preview.trim()
    if (!text) return []
    return [{ at: chatStamp(note.created_at), sender: note.sender_name, text }]
  })
}

/**
 * Every named heading, in document order, so a chat can sit under the right one.
 * A removed heading is left out: its row carries no tocId and joins the tail.
 */
function headingIndex(tree: SectionNode[]): { tocId: string; text: string }[] {
  const rows: { tocId: string; text: string }[] = []
  const walk = (nodes: SectionNode[]): void => {
    for (const node of nodes) {
      if (node.status !== 'removed' && node.tocId && node.text.length > 0) {
        rows.push({ tocId: node.tocId, text: node.text })
      }
      walk(node.children)
    }
  }
  walk(tree)
  return rows
}

/**
 * A heading chat is the channel whose id is the heading. Those lines move under
 * the heading. A channel that does not match stays in the channel card.
 */
function placeHeadingChats(
  doc: DigestDocument,
  changed: DigestChangedSection[],
  headings: readonly { tocId: string; text: string }[]
): { sections: DigestChangedSection[]; channels: DigestDocument['channels'] } {
  const byChannel = new Map(
    doc.channels.filter((channel) => channel.id).map((channel) => [channel.id, channel])
  )
  const changedById = new Map(
    changed.flatMap((row) => (row.tocId ? [[row.tocId, row] as const] : []))
  )
  const sections: DigestChangedSection[] = []
  const seen = new Set<string>()
  const moved = new Set<string>()

  const emit = (tocId: string, text: string, row?: DigestChangedSection) => {
    if (seen.has(tocId)) return
    const chats = headingChats(byChannel.get(tocId)?.notifications ?? [])
    if (!row && chats.length === 0) return
    seen.add(tocId)
    if (chats.length > 0) moved.add(tocId)
    const base = row ?? { text, url: sectionUrl(doc.url, tocId), tocId, chatOnly: true as const }
    sections.push(chats.length > 0 ? { ...base, chats } : base)
  }

  for (const heading of headings) {
    emit(heading.tocId, heading.text, changedById.get(heading.tocId))
  }
  for (const row of changed) {
    if (!row.tocId) sections.push(row)
  }

  return {
    sections,
    channels: doc.channels.filter((channel) => !channel.id || !moved.has(channel.id))
  }
}

/**
 * Depth-first, document order. An `unchanged` node is dropped. A nameless row
 * is dropped too: it would be a live link with no label.
 */
export function flattenChangedSections(
  tree: SectionNode[],
  docUrl: string
): DigestChangedSection[] {
  const rows: DigestChangedSection[] = []

  const walk = (nodes: SectionNode[]): void => {
    for (const node of nodes) {
      if (node.status !== 'unchanged' && node.text.length > 0) {
        rows.push({
          text: node.text,
          // A removed section's anchor resolves to nothing, so this links to
          // the document rather than offering a link that goes nowhere.
          url: node.status === 'removed' ? docUrl : sectionUrl(docUrl, node.tocId),
          ...(node.status !== 'removed' && node.tocId ? { tocId: node.tocId } : {}),
          ...(node.excerpt ? { excerpt: node.excerpt } : {}),
          ...(node.removedExcerpt ? { removed: node.removedExcerpt } : {}),
          ...(node.runs?.length ? { runs: node.runs } : {})
        })
      }
      walk(node.children)
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

  const tree = outcome.result.sections ?? []
  const rows = flattenChangedSections(tree, doc.url)
  const placed = placeHeadingChats(doc, rows, headingIndex(tree))
  if (placed.sections.length === 0) return doc

  const sections = placed.sections
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
      sections,
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
