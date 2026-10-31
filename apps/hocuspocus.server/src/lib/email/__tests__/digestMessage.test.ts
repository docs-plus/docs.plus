import { describe, expect, test } from 'bun:test'

import type { PadLinkRow } from '../../padLink'
import { buildDigestDocuments, type DigestRawNotification } from '../digestDocuments'
import { decideDigestOutcome, parseLastVisitStamp, visibleDigestDocuments } from '../digestMessage'

const OWNER = 'owner-uuid'
const STRANGER = 'stranger-uuid'
const APP = 'https://docs.plus'

const row = (over: Partial<PadLinkRow> = {}): PadLinkRow => ({
  documentId: 'Doc1',
  title: 'Quarterly plan',
  slug: 'quarterly-plan',
  isPrivate: false,
  ownerId: OWNER,
  deletedAt: null,
  ...over
})

// The real rule reads from `contentChangeAudience`, so this suite proves that a
// private title cannot reach a non-owner. A stub would prove only itself.
const visible = (rows: PadLinkRow[], recipientId: string) =>
  visibleDigestDocuments(rows, recipientId)

describe('visibleDigestDocuments privacy gate', () => {
  test('a public document reaches any recipient, with its human name', () => {
    const map = visible([row()], STRANGER)
    expect(map.get('Doc1')).toEqual({ title: 'Quarterly plan', slug: 'quarterly-plan' })
  })

  test('a private document reaches its owner', () => {
    expect(visible([row({ isPrivate: true })], OWNER).has('Doc1')).toBe(true)
  })

  test('a private document reaches nobody else, so its title never escapes', () => {
    expect(visible([row({ isPrivate: true })], STRANGER).size).toBe(0)
  })

  test('a private document with no owner reaches nobody', () => {
    expect(visible([row({ isPrivate: true, ownerId: null })], OWNER).size).toBe(0)
  })

  test('a trashed document reaches nobody, its owner included', () => {
    expect(visible([row({ deletedAt: new Date('2026-09-01T00:00:00.000Z') })], OWNER).size).toBe(0)
  })

  test('one refused row does not cost the others', () => {
    const map = visible(
      [row({ isPrivate: true }), row({ documentId: 'Doc2', slug: 'notes' })],
      STRANGER
    )
    expect([...map.keys()]).toEqual(['Doc2'])
  })
})

describe('parseLastVisitStamp', () => {
  test('an absent stamp is no Last left', () => {
    expect(parseLastVisitStamp(null)).toBeNull()
    expect(parseLastVisitStamp(undefined)).toBeNull()
    expect(parseLastVisitStamp('')).toBeNull()
  })

  test('an unreadable stamp is no Last left, rather than an Invalid Date', () => {
    expect(parseLastVisitStamp('never')).toBeNull()
  })

  test('a readable stamp keeps its instant', () => {
    expect(parseLastVisitStamp('2026-09-06T08:30:00.000Z')?.toISOString()).toBe(
      '2026-09-06T08:30:00.000Z'
    )
  })
})

// The SQL sends `workspace_slug`, the lowercased id. It must never reach a link.
const chat = (over: Partial<DigestRawNotification> = {}): DigestRawNotification =>
  ({
    notification_type: 'message',
    sender_name: 'Ada',
    sender_avatar_url: null,
    message_preview: 'hello',
    channel_id: 'ch1',
    channel_name: 'General',
    workspace_id: 'Doc1',
    workspace_slug: 'doc1',
    created_at: '2026-09-07T10:00:00.000Z',
    ...over
  }) as DigestRawNotification

const carrier = (documentId: string): DigestRawNotification =>
  chat({ notification_type: 'content_change', channel_id: documentId, workspace_id: documentId })

/** Build then decide, as `processDigestMessage` does, with the real privacy gate. */
const digest = (notifications: DigestRawNotification[], rows: PadLinkRow[], reader = STRANGER) =>
  decideDigestOutcome({
    documents: buildDigestDocuments(notifications, visible(rows, reader), APP),
    metaReadFailed: false
  })

describe('digest links and leave-out', () => {
  test('every link carries the pad slug, never workspace_slug', () => {
    const outcome = digest([chat()], [row()])
    if (outcome.kind !== 'send') throw new Error(`expected send, got ${outcome.kind}`)
    const [doc] = outcome.documents
    expect(doc.url).toBe('https://docs.plus/quarterly-plan')
    expect(doc.channels[0].url).toBe('https://docs.plus/quarterly-plan?chatroom=ch1')
    expect(doc.channels[0].notifications[0].action_url).toBe(
      'https://docs.plus/quarterly-plan?chatroom=ch1'
    )
  })

  test('a document the reader cannot open leaves out, chat and block alike', () => {
    const outcome = digest(
      [chat(), carrier('Doc1'), chat({ workspace_id: 'Doc2', channel_id: 'ch2' })],
      [row({ isPrivate: true }), row({ documentId: 'Doc2', slug: 'notes' })]
    )
    if (outcome.kind !== 'send') throw new Error(`expected send, got ${outcome.kind}`)
    expect(outcome.documents.map((doc) => doc.workspace_id)).toEqual(['Doc2'])
  })

  test('a digest of only unopenable documents is skipped, so its rows settle', () => {
    const trashed = row({ deletedAt: new Date('2026-09-01T00:00:00.000Z') })
    expect(digest([chat(), carrier('Doc1')], [trashed], OWNER).kind).toBe('skip')
  })

  test('a document with no metadata row leaves out', () => {
    expect(digest([chat()], []).kind).toBe('skip')
  })
})

describe('decideDigestOutcome', () => {
  test('defers when the metadata read failed', () => {
    expect(decideDigestOutcome({ documents: [], metaReadFailed: true }).kind).toBe('defer')
  })

  test('the defer arm runs ahead of the empty arm', () => {
    // A failed read leaves every document out, so the digest arrives here reading
    // empty. Acking it would mark the carriers read and the 24-hour dedupe would
    // then eat the next fan-out, losing the notification for good.
    const documents = buildDigestDocuments([chat(), carrier('Doc1')], new Map(), APP)
    expect(decideDigestOutcome({ documents, metaReadFailed: true }).kind).toBe('defer')
  })
})
