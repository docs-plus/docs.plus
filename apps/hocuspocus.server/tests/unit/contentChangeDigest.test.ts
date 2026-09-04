/**
 * The content-change privacy rule and the digest shaping it feeds. Pure inputs
 * only: no Prisma, no Supabase, no mock.module. The guard order in
 * `resolveContentChangeAudience` is what these pin — swap two lines there and a
 * trashed public document silently reaches everyone.
 */
import { countDigestItems, renderDigestEmail } from '@docs.plus/email-templates'
import { describe, expect, it } from 'bun:test'

import { resolveContentChangeAudience } from '../../src/lib/contentChangeFanout'
import { filterDigestDocuments } from '../../src/lib/email/digestDocuments'
import { buildDigestEmailText } from '../../src/lib/email/templates'
import type { DigestDocument } from '../../src/types/email.types'

const OWNER = 'owner-uuid'

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
      documents: [changedDoc()],
      unsubscribeUrl: 'https://docs.plus/unsubscribe'
    })
    expect(text).toContain('2026-09-02')
  })
})
