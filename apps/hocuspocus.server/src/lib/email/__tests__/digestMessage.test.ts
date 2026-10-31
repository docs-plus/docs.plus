import { describe, expect, test } from 'bun:test'

import type { PadLinkRow } from '../../padLink'
import { buildDigestDocuments, type DigestRawNotification } from '../digestDocuments'
import { parseLastVisitStamp, planDigestMails, visibleDigestDocuments } from '../digestMessage'

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
describe('visibleDigestDocuments privacy gate', () => {
  test('a public document reaches any recipient, with its human name', () => {
    const map = visibleDigestDocuments([row()], STRANGER)
    expect(map.get('Doc1')).toEqual({ title: 'Quarterly plan', slug: 'quarterly-plan' })
  })

  test('a private document reaches its owner', () => {
    expect(visibleDigestDocuments([row({ isPrivate: true })], OWNER).has('Doc1')).toBe(true)
  })

  test('a private document reaches nobody else, so its title never escapes', () => {
    expect(visibleDigestDocuments([row({ isPrivate: true })], STRANGER).size).toBe(0)
  })

  test('a private document with no owner reaches nobody', () => {
    expect(visibleDigestDocuments([row({ isPrivate: true, ownerId: null })], OWNER).size).toBe(0)
  })

  test('a trashed document reaches nobody, its owner included', () => {
    expect(
      visibleDigestDocuments([row({ deletedAt: new Date('2026-09-01T00:00:00.000Z') })], OWNER).size
    ).toBe(0)
  })

  test('one refused row does not cost the others', () => {
    const map = visibleDigestDocuments(
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

/** Build then plan, as `processDigestMessage` does, with the real privacy gate. */
const digest = (notifications: DigestRawNotification[], rows: PadLinkRow[], reader = STRANGER) => {
  const built = buildDigestDocuments(notifications, visibleDigestDocuments(rows, reader), APP)
  return planDigestMails({
    documents: built.documents,
    metaReadFailed: false,
    grouping: 'aggregate',
    queueIds: [],
    queueIdsByDocument: built.queueIdsByDocument
  })
}

describe('digest links and leave-out', () => {
  test('every link carries the pad slug, never workspace_slug', () => {
    const plan = digest([chat()], [row()])
    if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`)
    const [doc] = plan.mails[0].documents
    expect(doc.url).toBe('https://docs.plus/quarterly-plan')
    expect(doc.channels[0].url).toBe('https://docs.plus/quarterly-plan?chatroom=ch1')
    expect(doc.channels[0].notifications[0].action_url).toBe(
      'https://docs.plus/quarterly-plan?chatroom=ch1'
    )
  })

  test('a document the reader cannot open leaves out, chat and block alike', () => {
    const plan = digest(
      [chat(), carrier('Doc1'), chat({ workspace_id: 'Doc2', channel_id: 'ch2' })],
      [row({ isPrivate: true }), row({ documentId: 'Doc2', slug: 'notes' })]
    )
    if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`)
    expect(plan.mails[0].documents.map((doc) => doc.workspace_id)).toEqual(['Doc2'])
  })

  test('a digest of only unopenable documents is skipped, so its rows settle', () => {
    const trashed = row({ deletedAt: new Date('2026-09-01T00:00:00.000Z') })
    expect(digest([chat(), carrier('Doc1')], [trashed], OWNER).kind).toBe('skip')
  })

  test('a document with no metadata row leaves out', () => {
    expect(digest([chat()], []).kind).toBe('skip')
  })
})

describe('planDigestMails', () => {
  test('the defer arm runs ahead of the empty arm', () => {
    // Acking an empty read marks the carriers read, and the dedupe eats the next fan-out.
    const built = buildDigestDocuments([chat(), carrier('Doc1')], new Map(), APP)
    const plan = planDigestMails({
      documents: built.documents,
      metaReadFailed: true,
      grouping: 'document',
      queueIds: ['q1'],
      queueIdsByDocument: built.queueIdsByDocument
    })
    expect(plan.kind).toBe('defer')
  })
})

/** Each mail's queue ids, then the left-over ones, from the plan `processDigestMessage` sends. */
const mailQueueIds = (notifications: DigestRawNotification[], rows: PadLinkRow[]) => {
  const built = buildDigestDocuments(notifications, visibleDigestDocuments(rows, STRANGER), APP)
  // Enrichment drops a carrier block whose window did not change.
  const documents = built.documents.map((doc) =>
    doc.workspace_id === 'Doc3' ? { ...doc, content_changes: undefined } : doc
  )
  const plan = planDigestMails({
    documents,
    metaReadFailed: false,
    grouping: 'document',
    queueIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
    queueIdsByDocument: built.queueIdsByDocument
  })
  if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`)
  return { perMail: plan.mails.map((mail) => mail.queueIds), leftOver: plan.leftOver }
}

describe('digest queue ids per mail', () => {
  const rows = [
    row(),
    row({ documentId: 'Doc2', slug: 'notes' }),
    row({ documentId: 'Doc3', slug: 'empty' }),
    row({ documentId: 'Secret', slug: 'secret', isPrivate: true })
  ]
  const notifications = [
    chat({ queue_id: 'q1' }),
    chat({ queue_id: 'q2', workspace_id: 'Doc2', channel_id: 'ch2' }),
    { ...carrier('Doc3'), queue_id: 'q3' },
    chat({ queue_id: 'q4', workspace_id: 'Secret', channel_id: 'ch4' }),
    // The channel row is gone, so the chat maps to no document.
    chat({ queue_id: 'q5', workspace_id: null, channel_id: 'gone' })
  ]

  test('each mail settles its own rows; the rest settle skipped', () => {
    // q6 is a row whose notification the SQL join dropped.
    expect(mailQueueIds(notifications, rows)).toEqual({
      perMail: [['q1'], ['q2']],
      leftOver: ['q3', 'q4', 'q5', 'q6']
    })
  })

  test('a message without per-notification ids keeps every id on every mail', () => {
    const old = notifications.map(({ queue_id, ...n }) => n)
    const all = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']
    expect(mailQueueIds(old, rows)).toEqual({ perMail: [all, all], leftOver: [] })
  })
})
