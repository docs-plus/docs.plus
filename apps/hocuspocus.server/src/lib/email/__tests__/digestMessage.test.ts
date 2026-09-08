import { describe, expect, test } from 'bun:test'

import type { DigestDocument } from '../../../types/email.types'
import {
  decideDigestOutcome,
  type DigestMetadataRow,
  type DigestOutcomeInput,
  parseLastVisitStamp,
  visibleDigestDocuments
} from '../digestMessage'

const OWNER = 'owner-uuid'
const STRANGER = 'stranger-uuid'
const NOW = new Date('2026-09-07T12:00:00.000Z')

const row = (over: Partial<DigestMetadataRow> = {}): DigestMetadataRow => ({
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
const visible = (rows: DigestMetadataRow[], recipientId: string) =>
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

const chatDoc = (over: Partial<DigestDocument> = {}): DigestDocument => ({
  name: 'Quarterly plan',
  slug: 'quarterly-plan',
  url: 'https://docs.plus/quarterly-plan',
  workspace_id: 'Doc1',
  channels: [
    {
      name: 'General',
      id: 'ch1',
      url: 'https://docs.plus/quarterly-plan?chatroom=ch1',
      notifications: [
        {
          type: 'message',
          sender_name: 'Ada',
          message_preview: 'hello',
          action_url: 'https://docs.plus/quarterly-plan?chatroom=ch1',
          created_at: '2026-09-07T10:00:00.000Z'
        }
      ]
    }
  ],
  ...over
})

const blockDoc = (over: Partial<DigestDocument> = {}): DigestDocument =>
  chatDoc({
    channels: [],
    content_changes: {
      document_id: 'Doc1',
      since: '2026-09-06T12:00:00.000Z',
      fromLastLeft: false
    },
    ...over
  })

const input = (over: Partial<DigestOutcomeInput> = {}): DigestOutcomeInput => ({
  built: [chatDoc()],
  enriched: [chatDoc()],
  visible: new Set(['Doc1']),
  metaReadFailed: false,
  ...over
})

describe('decideDigestOutcome', () => {
  test('defers a message whose block could not be re-read', () => {
    const built = [blockDoc()]
    const outcome = decideDigestOutcome(input({ built, enriched: built, metaReadFailed: true }))
    expect(outcome.kind).toBe('defer')
  })

  test('the defer arm runs ahead of the empty arm', () => {
    // A failed re-read strips every block, so a content-only digest arrives here
    // reading empty. Acking it would mark the carriers read and the 24-hour
    // dedupe would then eat the next fan-out, losing the notification for good.
    const built = [blockDoc()]
    const outcome = decideDigestOutcome(
      input({ built, enriched: built, metaReadFailed: true, visible: new Set() })
    )
    expect(outcome.kind).toBe('defer')
  })

  test('a chat-only digest still sends when the re-read failed', () => {
    // The id list covers every chat document too, so a bare read failure must not
    // hold back a message that asked no privacy question.
    const outcome = decideDigestOutcome(input({ metaReadFailed: true, visible: new Set() }))
    expect(outcome.kind).toBe('send')
  })

  test('skips a digest left with nothing to say', () => {
    const outcome = decideDigestOutcome(input({ built: [], enriched: [] }))
    expect(outcome.kind).toBe('skip')
  })

  test('drops a block this recipient may no longer see but keeps the chat', () => {
    const doc = chatDoc({
      content_changes: { document_id: 'Doc1', since: NOW.toISOString(), fromLastLeft: false }
    })
    const outcome = decideDigestOutcome(
      input({ built: [doc], enriched: [doc], visible: new Set() })
    )
    if (outcome.kind !== 'send') throw new Error(`expected send, got ${outcome.kind}`)
    expect(outcome.documents[0].content_changes).toBeUndefined()
    expect(outcome.documents[0].channels[0].notifications).toHaveLength(1)
  })

  test('a document left with neither a block nor chat drops out entirely', () => {
    const doc = blockDoc()
    const outcome = decideDigestOutcome(
      input({ built: [doc], enriched: [doc], visible: new Set() })
    )
    expect(outcome.kind).toBe('skip')
  })

  test('the send arm carries the documents that survived both gates', () => {
    const outcome = decideDigestOutcome(input())
    if (outcome.kind !== 'send') throw new Error(`expected send, got ${outcome.kind}`)
    expect(outcome.documents.map((doc) => doc.workspace_id)).toEqual(['Doc1'])
  })
})
