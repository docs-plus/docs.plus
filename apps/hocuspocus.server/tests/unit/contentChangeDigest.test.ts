/**
 * The content-change privacy rule and the digest shaping it feeds. Pure inputs
 * only: no Prisma, no Supabase, no mock.module. The guard order in
 * `resolveContentChangeAudience` is what these pin — swap two lines there and a
 * trashed public document silently reaches everyone.
 */
import { buildDigestEmail, countDigestItems, fitDigestDocuments } from '@docs.plus/email-templates'
import { describe, expect, it } from 'bun:test'

import { resolveContentChangeAudience } from '../../src/lib/contentChangeFanout'
import { enrichDigestDocuments, resolveDigestSince } from '../../src/lib/email/digestContentChanges'
import { filterDigestDocuments, groupDigestDocuments } from '../../src/lib/email/digestDocuments'
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
  content_changes: {
    document_id: 'Doc123',
    fromLastLeft: false,
    since: '2026-09-02T10:00:00.000Z'
  }
})

/** The pre-enrichment shape: the raw id as the name, `lower(id)` as the slug. */
const enrichableDoc = (documentId = DOC_ID): EnrichableDocument => ({
  name: documentId,
  slug: documentId.toLowerCase(),
  url: `https://docs.plus/${documentId.toLowerCase()}`,
  workspace_id: documentId,
  channels: [],
  content_changes: {
    document_id: documentId,
    fromLastLeft: false,
    since: '2026-09-02T10:00:00.000Z'
  }
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
      sectionsMoved: 0,
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
  readLastVisits: async (_reader: string, ids: string[]) => new Map(ids.map((id) => [id, null])),
  logger: silentLogger,
  recipientId: OWNER,
  frequency: 'daily' as const,
  now: NOW,
  retentionDays: 30,
  appUrl: 'https://docs.plus',
  ...over
})

describe('groupDigestDocuments', () => {
  const docs = [changedDoc(), { ...changedDoc(), slug: 'second', name: 'Second' }]

  it('sends one mail per document unless an admin combines them', () => {
    expect(groupDigestDocuments(docs, 'document')).toEqual([[docs[0]], [docs[1]]])
    expect(groupDigestDocuments(docs, 'aggregate')).toEqual([docs])
    expect(groupDigestDocuments([docs[0]!], 'document')).toEqual([[docs[0]]])
  })
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

/** A heading chat: the channel id is the heading's toc-id. */
const headingChannel = (tocId: string, text: string, createdAt: string) => ({
  name: tocId,
  id: tocId,
  url: `${DOC_URL}?chatroom=${tocId}`,
  notifications: [
    {
      type: 'message' as const,
      sender_name: 'Lena',
      message_preview: text,
      action_url: `${DOC_URL}?chatroom=${tocId}`,
      created_at: createdAt
    }
  ]
})

describe('enrichDigestDocuments', () => {
  // A toc id is stranger-written on a public document, so it is encoded.
  it('encodes the toc id into the link and falls back to the document url', async () => {
    const [doc] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({
        computeChanges: async () =>
          changesResult({
            sections: [
              section({ text: 'Deep', tocId: 'deep id&1' }),
              section({ text: 'Sibling', tocId: null, status: 'added' })
            ]
          })
      })
    )
    const rows = doc!.content_changes!.sections!
    expect(rows[0]!.url).toBe(`${DOC_URL}?id=deep%20id%261`)
    expect(rows[0]!.tocId).toBe('deep id&1')
    expect(rows[1]!.url).toBe(DOC_URL)
    expect(rows[1]!.tocId).toBeUndefined()
  })

  // A removed heading and a heading with no toc-id once fell to the tail, after
  // every live heading. The mail then read out of document order.
  it('keeps a removed heading in its document place', async () => {
    const [doc] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({
        computeChanges: async () =>
          changesResult({
            sections: [
              // The preamble sanitises to '', and a nameless changed row is kept.
              section({ text: '', level: 0, tocId: 'preamble' }),
              section({
                text: 'Alpha',
                tocId: 'alpha',
                children: [section({ text: 'Beta', level: 2, tocId: 'beta', status: 'removed' })]
              }),
              section({ text: 'Sibling', tocId: null, status: 'added' }),
              section({ text: 'Gamma', tocId: 'gamma' })
            ]
          })
      })
    )
    const rows = doc!.content_changes!.sections!
    expect(rows.map((row) => row.text)).toEqual(['', 'Alpha', 'Beta', 'Sibling', 'Gamma'])
    // A nameless row has no label to click, so it opens the document.
    expect(rows[0]!.url).toBe(DOC_URL)
    expect(rows[0]!.tocId).toBeUndefined()
  })

  // The fit drops a heading only when it came in for its chats alone. A wrong
  // check either drops a changed heading or leaves an empty one in the mail.
  it('keeps a changed heading with no runs and drops a chat-only one in the fit', async () => {
    const docIn = enrichableDoc()
    docIn.channels = [
      headingChannel('quiet', 'Only a chat here.', '2026-09-21T09:00:00.000Z'),
      headingChannel('moved', 'Moved it up.', '2026-09-21T10:00:00.000Z')
    ]
    const [doc] = await enrichDigestDocuments(
      [docIn],
      enrichDeps({
        computeChanges: async () =>
          changesResult({
            sections: [
              section({ text: 'Quiet', tocId: 'quiet', status: 'unchanged' }),
              section({ text: 'Moved', tocId: 'moved', status: 'moved' })
            ]
          })
      })
    )
    expect(doc!.content_changes?.sections?.map((row) => row.text)).toEqual(['Quiet', 'Moved'])

    const fitted = fitDigestDocuments(
      {
        recipientName: 'Ada',
        frequency: 'daily',
        documents: [doc!],
        periodEnd: '2026-09-03T00:00:00.000Z'
      },
      1
    )
    const sections = fitted[0]!.content_changes?.sections
    expect(sections?.map((row) => row.text)).toEqual(['Moved'])
    expect(sections?.[0]!.chats).toBeUndefined()
  })

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

  // The email says "since you left" on this flag alone, so a wrong value is a
  // falsehood in the body rather than a missing detail.
  it('marks the window as Last left only when the reader has one', async () => {
    const changed = async () =>
      changesResult({ sections: [section({ text: 'Intro', tocId: 'intro' })] })

    const [never] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({ computeChanges: changed })
    )
    // Explicit false, not undefined: absent means enrichment never ran.
    expect(never!.content_changes?.fromLastLeft).toBe(false)

    const [after] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({
        computeChanges: changed,
        readLastVisits: async (_reader: string, ids: string[]) =>
          new Map(ids.map((id) => [id, new Date(NOW.getTime() - 17 * 60 * 1000)]))
      })
    )
    expect(after!.content_changes?.fromLastLeft).toBe(true)
  })

  // The retention floor can move the window start months past Last left. The words
  // "since you left" would then name the floor date, not the real departure.
  it('drops the Last left claim when retention clamps the window start', async () => {
    const [doc] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({
        computeChanges: async () =>
          changesResult({ sections: [section({ text: 'Intro', tocId: 'intro' })] }),
        readLastVisits: async (_reader: string, ids: string[]) =>
          new Map(ids.map((id) => [id, new Date(NOW.getTime() - 120 * DAY)]))
      })
    )
    expect(doc!.content_changes?.fromLastLeft).toBe(false)
    expect(doc!.content_changes?.since).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString())
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

  it('keeps every changed heading and lets the mail size decide the cut', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      section({ text: `Section ${index + 1}`, tocId: `h${index + 1}` })
    )
    const [doc] = await enrichDigestDocuments(
      [enrichableDoc()],
      enrichDeps({ computeChanges: async () => changesResult({ sections: many }) })
    )
    expect(doc!.content_changes?.sections).toHaveLength(25)
  })

  it('puts a heading chat under that heading and drops the channel card', async () => {
    const docIn = enrichableDoc()
    docIn.channels = [
      {
        name: 'Intro',
        id: 'intro',
        url: `${DOC_URL}?chatroom=intro`,
        notifications: [
          {
            type: 'message',
            sender_name: 'Lena',
            message_preview: 'The second click should close it.',
            action_url: `${DOC_URL}?chatroom=intro`,
            created_at: '2026-09-21T09:14:00.000Z'
          }
        ]
      },
      {
        name: 'general',
        id: 'room-general',
        url: `${DOC_URL}?chatroom=room-general`,
        notifications: [
          {
            type: 'mention',
            sender_name: 'John',
            message_preview: 'Review the auth section',
            action_url: `${DOC_URL}?chatroom=room-general`,
            created_at: '2026-09-21T10:00:00.000Z'
          }
        ]
      }
    ]
    const [doc] = await enrichDigestDocuments(
      [docIn],
      enrichDeps({
        computeChanges: async () =>
          changesResult({
            sections: [
              section({ text: 'Quiet', tocId: 'quiet', status: 'unchanged' }),
              section({ text: 'Intro', tocId: 'intro' })
            ]
          })
      })
    )
    const intro = doc!.content_changes?.sections?.find((row) => row.text === 'Intro')
    expect(intro?.chats).toEqual([
      {
        type: 'message',
        sender_name: 'Lena',
        message_preview: 'The second click should close it.',
        action_url: `${DOC_URL}?chatroom=intro`,
        created_at: '2026-09-21T09:14:00.000Z'
      }
    ])
    expect(doc!.channels.map((channel) => channel.id)).toEqual(['room-general'])
    expect(doc!.content_changes?.sections?.some((row) => row.text === 'Quiet')).toBe(false)

    const { html } = buildDigestEmail({
      recipientName: 'Ada',
      frequency: 'daily',
      documents: [doc!],
      periodEnd: '2026-09-03T00:00:00.000Z'
    })
    const introAt = html.indexOf('>Intro<')
    const chatAt = html.indexOf('The second click should close it.')
    const cardAt = html.indexOf('# general')
    expect(introAt).toBeGreaterThan(-1)
    expect(chatAt).toBeGreaterThan(introAt)
    expect(cardAt).toBeGreaterThan(chatAt)
    expect(html).toContain('Review the auth section')
    expect(html).toContain(`${DOC_URL}?chatroom=intro`)
  })
})

describe('the rendered digest', () => {
  // A substring, never a full-HTML snapshot: the surrounding markup is unstable
  // and a snapshot would fail on every unrelated style change.
  it('names the change window in the HTML body', () => {
    const { html } = buildDigestEmail({
      recipientName: 'Ada',
      frequency: 'daily',
      documents: [changedDoc()],
      periodEnd: '2026-09-03T00:00:00.000Z'
    })
    expect(html).toContain('✏️ Changed in the last day.')
  })

  it('names the change window in the plaintext body', () => {
    // Both surfaces take the same window end, which is what stops them drifting.
    const { text } = buildDigestEmail({
      recipientName: 'Ada',
      frequency: 'daily',
      documents: [changedDoc()],
      periodEnd: '2026-09-03T00:00:00.000Z'
    })
    expect(text).toContain('✏️ Changed in the last day.')
  })
})
