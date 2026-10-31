/**
 * Chat rows reach the push and email queues with no pad link. These pin the link the
 * consumers build, and that no chat link ever lands on Home or on a lowercased id.
 */
import { describe, expect, it } from 'bun:test'

import { chatLink, type ChatLinkLookups, type ChatPushFields } from '../chatLink'
import type { PadLinkRow } from '../padLink'

const DOC_ID = 'V6a648b3056yMseWrj1'
const APP = 'https://docs.plus'
const READER = 'reader-uuid'

const padRow = (over: Partial<PadLinkRow> = {}): PadLinkRow => ({
  documentId: DOC_ID,
  slug: 'api-docs',
  title: 'API docs',
  isPrivate: false,
  ownerId: 'owner-uuid',
  deletedAt: null,
  ...over
})

const payload = (over: Partial<ChatPushFields> = {}): ChatPushFields => ({
  notification_id: 'notif-1',
  type: 'mention',
  action_url: '',
  channel_id: 'heading-1',
  ...over
})

const pushLookups = (
  row: PadLinkRow | null = padRow(),
  messageId: string | null = 'msg-1'
): ChatLinkLookups => ({
  readSource: async () => ({ messageId, documentId: DOC_ID }),
  readPadRow: async (documentId) => (documentId === DOC_ID ? row : null)
})

describe('chatLink.forPush', () => {
  it('links the human slug, the chatroom and the message', async () => {
    expect(await chatLink.forPush(payload(), pushLookups())).toBe(
      '/api-docs?chatroom=heading-1&msg_id=msg-1'
    )
  })

  it('leaves out msg_id when the row names no message', async () => {
    expect(await chatLink.forPush(payload(), pushLookups(padRow(), null))).toBe(
      '/api-docs?chatroom=heading-1'
    )
  })

  it('keeps the empty link when the document has no metadata row', async () => {
    expect(await chatLink.forPush(payload(), pushLookups(null))).toBe('')
  })

  it('has no reader gate: a Private or trashed pad still links', async () => {
    const link = '/api-docs?chatroom=heading-1&msg_id=msg-1'
    expect(await chatLink.forPush(payload(), pushLookups(padRow({ isPrivate: true })))).toBe(link)
    expect(await chatLink.forPush(payload(), pushLookups(padRow({ deletedAt: new Date() })))).toBe(
      link
    )
  })

  it('keeps a link the row already carries', async () => {
    const own = 'https://docs.plus/api-docs'
    expect(await chatLink.forPush(payload({ action_url: own }), pushLookups())).toBe(own)
  })

  it('builds no chat link for a row that is not a chat type', async () => {
    const row = payload({ type: 'content_change', channel_id: DOC_ID })
    expect(await chatLink.forPush(row, pushLookups())).toBe('')
  })
})

const emailLookups = (row: PadLinkRow | null = padRow()): ChatLinkLookups => ({
  readSource: async () => {
    throw new Error('the payload names the document')
  },
  readPadRow: async (documentId) => (documentId === DOC_ID ? row : null)
})

/** A row queued before #647 finds its document through the channel, which may be gone. */
const oldRowLookups = (documentId: string | null): ChatLinkLookups => ({
  readSource: async () => ({ documentId, messageId: null }),
  readPadRow: async (id) => (id === DOC_ID ? padRow() : null)
})

describe('chatLink.forEmail (#647)', () => {
  it('links the pad, the chatroom and the message, not Home', async () => {
    const fields = {
      recipient_id: READER,
      channel_id: 'heading-1',
      workspace_id: DOC_ID,
      message_id: 'msg-1'
    }
    expect(await chatLink.forEmail(fields, emailLookups(), APP)).toEqual({
      kind: 'link',
      url: 'https://docs.plus/api-docs?chatroom=heading-1&msg_id=msg-1'
    })
  })

  it('an old row finds its document through the channel, never ?chatroom= on Home', async () => {
    const outcome = await chatLink.forEmail(
      { recipient_id: READER, channel_id: 'heading-1' },
      oldRowLookups(DOC_ID),
      APP
    )
    expect(outcome).toEqual({ kind: 'link', url: 'https://docs.plus/api-docs?chatroom=heading-1' })
  })

  it('an old row whose channel is gone leaves out, never ?chatroom= on Home', async () => {
    const outcome = await chatLink.forEmail(
      { recipient_id: READER, channel_id: 'gone' },
      oldRowLookups(null),
      APP
    )
    expect(outcome).toEqual({ kind: 'leave-out' })
  })

  it('a Private document leaves out for a reader who is not its owner', async () => {
    const fields = { recipient_id: READER, channel_id: 'heading-1', workspace_id: DOC_ID }
    expect(await chatLink.forEmail(fields, emailLookups(padRow({ isPrivate: true })), APP)).toEqual(
      { kind: 'leave-out' }
    )
  })
})
