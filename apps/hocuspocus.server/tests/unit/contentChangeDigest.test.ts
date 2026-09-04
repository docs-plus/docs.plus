/**
 * The content-change privacy rule and the digest shaping it feeds. Pure inputs
 * only: no Prisma, no Supabase, no mock.module. The guard order in
 * `resolveContentChangeAudience` is what these pin — swap two lines there and a
 * trashed public document silently reaches everyone.
 */
import { countDigestItems, renderDigestEmail } from '@docs.plus/email-templates'
import { describe, expect, it } from 'bun:test'

import { resolveContentChangeAudience } from '../../src/lib/contentChangeFanout'
import {
  enrichDigestDocuments,
  flattenChangedSections,
  resolveDigestSince
} from '../../src/lib/email/digestContentChanges'
import { filterDigestDocuments } from '../../src/lib/email/digestDocuments'
import { buildDigestEmailText } from '../../src/lib/email/templates'
import type { ComputeOutcome, SectionNode } from '../../src/modules/document-changes/types'
import type { DigestDocument } from '../../src/types/email.types'

const OWNER = 'owner-uuid'

/** A real 19-character derived id. No digest link may ever show one. */
const DOC_ID = 'V6a648b3056yMseWrj1'
const DOC_URL = 'https://docs.plus/api-docs'
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-04T00:00:00.000Z')

/** `workspace_id` is the only exact-case join key a chat-only bucket carries. */
type EnrichableDocument = DigestDocument & { workspace_id: string }

const chatDoc = (): DigestDocument => ({
  name: 'Chat doc',
  slug: 'chat-doc',
  url: 'https://docs.plus/chat-doc',
  channels: [
    {
      name: 'General',
      id: 'c1',
      url: 'https://docs.plus/chat-doc?chatroom=c1',
      notifications: [
        {
          type: 'message',
          sender_name: 'Ada',
          message_preview: 'hello',
          action_url: 'https://docs.plus/chat-doc?chatroom=c1',
          created_at: '2026-09-01T00:00:00.000Z'
        }
      ]
    }
  ]
})

const changedDoc = (): DigestDocument => ({
  name: 'Changed doc',
  slug: 'changed-doc',
  url: 'https://docs.plus/changed-doc',
  channels: [],
  content_changes: { document_id: 'Doc123', since: '2026-09-02T10:00:00.000Z' }
})

/** The pre-enrichment shape: the raw id as the name, `lower(id)` as the slug. */
const enrichableDoc = (documentId = DOC_ID): EnrichableDocument => ({
  name: documentId,
  slug: documentId.toLowerCase(),
  url: `https://docs.plus/${documentId.toLowerCase()}`,
  workspace_id: documentId,
  channels: [],
  content_changes: { document_id: documentId, since: '2026-09-02T10:00:00.000Z' }
})

const section = (over: Partial<SectionNode> & { text: string }): SectionNode => ({
  tocId: null,
  level: 1,
  status: 'modified',
  magnitude: null,
  children: [],
  ...over
})

const changesResult = (
  over: { changed?: boolean; sections?: SectionNode[] } = {}
): ComputeOutcome => ({
  ok: true,
  result: {
    documentId: DOC_ID,
    since: new Date('2026-09-03T00:00:00.000Z'),
    until: NOW,
    baseline: null,
    head: { version: 2, createdAt: NOW },
    changed: over.changed ?? true,
    summary: {
      sectionsAdded: 0,
      sectionsRemoved: 0,
      sectionsModified: 1,
      wordsAdded: 3,
      wordsRemoved: 0,
      versions: 1,
      triggers: [],
      contributors: []
    },
    sections: over.sections ?? []
  }
})

const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
}

/**
 * Every collaborator is a plain function, so no assertion below reads "the mock
 * was called". This builder is the one place the dependency shape is named, so
 * a seam change is reconciled here and not in eight tests.
 */
const enrichDeps = (over: Record<string, unknown> = {}) => ({
  computeChanges: async () => changesResult(),
  readMetadata: async () => ({ title: 'API docs', slug: 'api-docs' }),
  readLastVisit: async () => null,
  logger: silentLogger,
  recipientId: OWNER,
  frequency: 'daily' as const,
  now: NOW,
  retentionDays: 30,
  appUrl: 'https://docs.plus',
  ...over
})

describe('resolveContentChangeAudience', () => {
  it('reaches everyone on a public document', () => {
    const audience = resolveContentChangeAudience({
      deletedAt: null,
      isPrivate: false,
      ownerId: OWNER
    })
    expect(audience).toEqual({ kind: 'all' })
  })

  it('reaches only the owner on a private document', () => {
    const audience = resolveContentChangeAudience({
      deletedAt: null,
      isPrivate: true,
      ownerId: OWNER
    })
    expect(audience).toEqual({ kind: 'owner', onlyUser: OWNER })
  })

  it('reaches nobody on a private document with no owner', () => {
    const audience = resolveContentChangeAudience({
      deletedAt: null,
      isPrivate: true,
      ownerId: null
    })
    expect(audience.kind).toBe('none')
  })

  // The case that pays for this file. Swap the deletedAt and isPrivate guards
  // and a trashed public document answers `all` instead of `none`.
  it('reaches nobody on a trashed document, even a public one', () => {
    const audience = resolveContentChangeAudience({
      deletedAt: new Date('2026-09-01T00:00:00.000Z'),
      isPrivate: false,
      ownerId: null
    })
    expect(audience.kind).toBe('none')
  })
})

describe('filterDigestDocuments', () => {
  it('keeps a document whose block the recipient may still see', () => {
    const kept = filterDigestDocuments([changedDoc()], new Set(['Doc123']))
    expect(kept).toHaveLength(1)
    expect(kept[0]!.content_changes?.document_id).toBe('Doc123')
  })

  it('drops a content-change-only document the recipient may no longer see', () => {
    const kept = filterDigestDocuments([changedDoc()], new Set<string>())
    expect(kept).toHaveLength(0)
  })

  it('keeps the chat and strips only the block when both are present', () => {
    const mixed: DigestDocument = { ...chatDoc(), content_changes: changedDoc().content_changes }
    const kept = filterDigestDocuments([mixed], new Set<string>())
    expect(kept).toHaveLength(1)
    expect(kept[0]!.content_changes).toBeUndefined()
    expect(kept[0]!.channels[0]!.notifications).toHaveLength(1)
  })

  // `withoutContentChanges` rebuilds the entry from an allow-list. A field left
  // off that list vanishes here, and enrichment then shows the raw 19-char id.
  it('carries workspace_id through the strip', () => {
    const mixed: EnrichableDocument = {
      ...chatDoc(),
      workspace_id: DOC_ID,
      content_changes: changedDoc().content_changes
    }
    const kept = filterDigestDocuments([mixed], new Set<string>()) as EnrichableDocument[]
    expect(kept[0]!.workspace_id).toBe(DOC_ID)
  })
})

describe('countDigestItems', () => {
  it('counts a legacy payload exactly as before', () => {
    const legacy = chatDoc()
    legacy.channels[0]!.notifications.push({ ...legacy.channels[0]!.notifications[0]! })
    expect(countDigestItems([legacy])).toBe(2)
  })

  it('counts a content-change-only document as one, never zero', () => {
    expect(countDigestItems([changedDoc()])).toBe(1)
  })
})

describe('resolveDigestSince', () => {
  it('uses the reader last visit when there is one', () => {
    const visit = new Date(NOW.getTime() - 3 * 60 * 60 * 1000)
    expect(resolveDigestSince(visit, 'daily', NOW, 30).getTime()).toBe(visit.getTime())
  })

  it('falls back to 24 hours on a daily digest with no visit', () => {
    expect(resolveDigestSince(null, 'daily', NOW, 30).getTime()).toBe(NOW.getTime() - DAY)
  })

  it('falls back to 7 days on a weekly digest with no visit', () => {
    expect(resolveDigestSince(null, 'weekly', NOW, 30).getTime()).toBe(NOW.getTime() - 7 * DAY)
  })

  // Without the floor a months-stale reader resolves a null baseline, and the
  // whole document then reads as added.
  it('clamps a stale visit to the retention floor', () => {
    const stale = new Date(NOW.getTime() - 120 * DAY)
    expect(resolveDigestSince(stale, 'daily', NOW, 30).getTime()).toBe(NOW.getTime() - 30 * DAY)
  })

  // DOC_AUTOSAVE_RETENTION_DAYS=0 disables pruning, so there is no floor to
  // clamp to. Clamping to now here would empty every digest window.
  it('applies no floor when retention is disabled', () => {
    const stale = new Date(NOW.getTime() - 120 * DAY)
    expect(resolveDigestSince(stale, 'daily', NOW, 0).getTime()).toBe(stale.getTime())
  })
})

describe('flattenChangedSections', () => {
  const tree = (): SectionNode[] => [
    section({ text: '', level: 0, tocId: 'preamble' }),
    section({
      text: 'Alpha',
      tocId: 'alpha',
      status: 'unchanged',
      children: [
        section({
          text: 'Beta',
          level: 2,
          tocId: 'beta',
          status: 'unchanged',
          children: [
            section({
              text: 'Gamma',
              level: 3,
              tocId: 'gamma',
              status: 'unchanged',
              children: [section({ text: 'Deep', level: 4, tocId: 'deep id&1' })]
            })
          ]
        }),
        section({ text: 'Sibling', level: 2, tocId: null, status: 'added' })
      ]
    })
  ]

  it('keeps document order and drops only the unchanged rows', () => {
    const rows = flattenChangedSections(tree(), DOC_URL)
    // The preamble sanitises to '', and a nameless row is dropped rather than
    // rendered as a live link with no label.
    expect(rows.map((row) => row.text)).toEqual(['Deep', 'Sibling'])
  })

  // The trap: an unchanged heading must still parent its changed child, or that
  // child loses its breadcrumb and reads as a root.
  it('names the two deepest ancestors of a change under an unchanged heading', () => {
    const rows = flattenChangedSections(tree(), DOC_URL)
    // Three ancestors deep, so "two deepest" cannot pass as "two shallowest".
    expect(rows[0]!.breadcrumb).toEqual(['Beta', 'Gamma'])
    expect(rows[0]!.breadcrumb).not.toContain('Alpha')
    expect(rows[1]!.breadcrumb).toEqual(['Alpha'])
  })

  // A toc id is stranger-written on a public document, so it is encoded.
  it('encodes the toc id into the link and falls back to the document url', () => {
    const rows = flattenChangedSections(tree(), DOC_URL)
    expect(rows[0]!.url).toBe(`${DOC_URL}?id=deep%20id%261`)
    expect(rows[1]!.url).toBe(DOC_URL)
  })
})

describe('enrichDigestDocuments', () => {
  it('keeps sending when compute throws, and still enriches the other document', async () => {
    const documents = await enrichDigestDocuments(
      [enrichableDoc('Bad6a648b3056yMseW'), enrichableDoc()],
      enrichDeps({
        computeChanges: async (request: { documentId: string }) => {
          if (request.documentId !== DOC_ID) throw new Error('compute unavailable')
          return changesResult({ sections: [section({ text: 'Intro', tocId: 'intro' })] })
        }
      })
    )
    expect(documents).toHaveLength(2)
    expect(documents[0]!.content_changes?.document_id).toBe('Bad6a648b3056yMseW')
    expect(documents[0]!.content_changes?.sections).toBeUndefined()
    expect(documents[1]!.content_changes?.sections).toHaveLength(1)
  })

  // A null workspace_id lands in one synthetic bucket. An unguarded lookup on it
  // throws, and the message-level catch then loses every block in the digest.
  it('leaves the unknown bucket untouched and enriches the real document', async () => {
    const unknown: DigestDocument = { ...chatDoc(), name: 'unknown', slug: 'unknown' }
    const documents = await enrichDigestDocuments(
      [unknown, enrichableDoc()],
      enrichDeps({
        computeChanges: async () =>
          changesResult({ sections: [section({ text: 'Intro', tocId: 'intro' })] })
      })
    )
    expect(documents[0]!.channels[0]!.notifications).toHaveLength(1)
    expect(documents[0]!.content_changes).toBeUndefined()
    // Without the guard, withResolvedName rewrites all four from the metadata.
    expect(documents[0]!.name).toBe('unknown')
    expect(documents[0]!.url).toBe(chatDoc().url)
    expect(documents[0]!.channels[0]!.notifications[0]!.action_url).toBe(
      chatDoc().channels[0]!.notifications[0]!.action_url
    )
    expect(documents[1]!.content_changes?.sections).toHaveLength(1)
  })

  it('names a document by its slug when the title is null or blank', async () => {
    const [nullTitle] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({ readMetadata: async () => ({ title: null, slug: 'api-docs' }) })
    )
    expect(nullTitle!.name).toBe('api-docs')

    const [blankTitle] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({ readMetadata: async () => ({ title: '', slug: 'api-docs' }) })
    )
    expect(blankTitle!.name).toBe('api-docs')
  })

  // `changed` is false on a first-open toc-id stamping pass. A block here mails
  // a digest whose body reads "0 sections changed".
  it('attaches no block when nothing changed in the window', async () => {
    const [doc] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({ computeChanges: async () => changesResult({ changed: false, sections: [] }) })
    )
    expect(doc!.content_changes).toBeUndefined()
  })

  it('builds every section link from the human slug, never the raw id', async () => {
    const [doc] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({
        computeChanges: async () =>
          changesResult({ sections: [section({ text: 'Intro', tocId: 'intro' })] })
      })
    )
    for (const row of doc!.content_changes!.sections!) {
      expect(row.url.startsWith(DOC_URL)).toBe(true)
      expect(row.url).not.toContain(DOC_ID)
    }
  })

  it('caps the list at eight rows and carries the rest as a count', async () => {
    const nine = Array.from({ length: 9 }, (_, index) =>
      section({ text: `Section ${index + 1}`, tocId: `h${index + 1}` })
    )
    const [doc] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({ computeChanges: async () => changesResult({ sections: nine }) })
    )
    expect(doc!.content_changes?.sections).toHaveLength(8)
    expect(doc!.content_changes?.moreCount).toBe(1)
    expect(doc!.content_changes?.sections?.at(-1)?.text).toBe('Section 8')

    const html = renderDigestEmail({
      recipientName: 'Ada',
      frequency: 'daily',
      documents: [doc!],
      periodStart: '2026-09-01T00:00:00.000Z',
      periodEnd: '2026-09-03T00:00:00.000Z'
    })
    expect(html).toContain('+1 more')
    // The plaintext overflow follows its own surroundings, where the channel cap
    // already reads "...and N more", so both house wordings are accepted.
    expect(
      buildDigestEmailText({ recipientName: 'Ada', frequency: 'daily', documents: [doc!] })
    ).toMatch(/(\+1 more|and 1 more)/)
  })
})

describe('the rendered digest', () => {
  // A substring, never a full-HTML snapshot: the surrounding markup is unstable
  // and a snapshot would fail on every unrelated style change.
  it('names the change date in the HTML body', () => {
    const html = renderDigestEmail({
      recipientName: 'Ada',
      frequency: 'daily',
      documents: [changedDoc()],
      periodStart: '2026-09-01T00:00:00.000Z',
      periodEnd: '2026-09-03T00:00:00.000Z'
    })
    expect(html).toContain('2026-09-02')
  })

  it('names the change date in the plaintext body', () => {
    const text = buildDigestEmailText({
      recipientName: 'Ada',
      frequency: 'daily',
      documents: [changedDoc()]
    })
    expect(text).toContain('2026-09-02')
  })
})
