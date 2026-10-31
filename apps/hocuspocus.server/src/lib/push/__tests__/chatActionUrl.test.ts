/**
 * Chat rows reach the push and email queues with no pad link. These pin the link the
 * consumers build, and that no chat link ever lands on Home or on a lowercased id.
 */
import { describe, expect, it } from 'bun:test'

import type { PadLinkRow } from '../../padLink'
import {
  type ChatActionUrlLookups,
  type ChatEmailLookups,
  type ChatPushFields,
  resolveChatActionUrl,
  resolveChatEmailLink
} from '../chatActionUrl'

const DOC_ID = 'V6a648b3056yMseWrj1'

const payload = (over: Partial<ChatPushFields> = {}): ChatPushFields => ({
  notification_id: 'notif-1',
  type: 'mention',
  action_url: '',
  channel_id: 'heading-1',
  ...over
})

const lookups = (
  slug: string | null,
  messageId: string | null = 'msg-1'
): ChatActionUrlLookups => ({
  readNotification: async () => ({ messageId, documentId: DOC_ID }),
  readSlug: async (documentId) => (documentId === DOC_ID ? slug : null)
})

describe('resolveChatActionUrl', () => {
  it('links the human slug, the chatroom and the message', async () => {
    expect(await resolveChatActionUrl(payload(), lookups('api-docs'))).toBe(
      '/api-docs?chatroom=heading-1&msg_id=msg-1'
    )
  })

  it('leaves out msg_id when the row names no message', async () => {
    expect(await resolveChatActionUrl(payload(), lookups('api-docs', null))).toBe(
      '/api-docs?chatroom=heading-1'
    )
  })

  it('keeps the empty link when the document has no metadata row', async () => {
    expect(await resolveChatActionUrl(payload(), lookups(null))).toBe('')
  })

  it('keeps a link the row already carries', async () => {
    const own = 'https://docs.plus/api-docs'
    expect(await resolveChatActionUrl(payload({ action_url: own }), lookups('x'))).toBe(own)
  })

  it('builds no chat link for a row that is not a chat type', async () => {
    const row = payload({ type: 'content_change', channel_id: DOC_ID })
    expect(await resolveChatActionUrl(row, lookups('api-docs'))).toBe('')
  })
})

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

const emailLookups = (row: PadLinkRow | null = padRow()): ChatEmailLookups => ({
  readChannelDocument: async (channelId) => (channelId === 'heading-1' ? DOC_ID : null),
  readPadRow: async (documentId) => (documentId === DOC_ID ? row : null)
})

describe('resolveChatEmailLink (#647)', () => {
  it('links the pad, the chatroom and the message, not Home', async () => {
    const fields = {
      recipient_id: READER,
      channel_id: 'heading-1',
      workspace_id: DOC_ID,
      message_id: 'msg-1'
    }
    expect(await resolveChatEmailLink(fields, emailLookups(), APP)).toEqual({
      kind: 'link',
      url: 'https://docs.plus/api-docs?chatroom=heading-1&msg_id=msg-1'
    })
  })

  it('an old row finds its document through the channel, never ?chatroom= on Home', async () => {
    const outcome = await resolveChatEmailLink(
      { recipient_id: READER, channel_id: 'heading-1' },
      emailLookups(),
      APP
    )
    expect(outcome).toEqual({ kind: 'link', url: 'https://docs.plus/api-docs?chatroom=heading-1' })
  })

  it('an old row whose channel is gone leaves out, never ?chatroom= on Home', async () => {
    const outcome = await resolveChatEmailLink(
      { recipient_id: READER, channel_id: 'gone' },
      emailLookups(),
      APP
    )
    expect(outcome).toEqual({ kind: 'leave-out' })
  })

  it('a Private document leaves out for a reader who is not its owner', async () => {
    const fields = { recipient_id: READER, channel_id: 'heading-1', workspace_id: DOC_ID }
    expect(
      await resolveChatEmailLink(fields, emailLookups(padRow({ isPrivate: true })), APP)
    ).toEqual({ kind: 'leave-out' })
  })
})
