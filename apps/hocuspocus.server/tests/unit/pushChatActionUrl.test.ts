/**
 * Chat rows reach the push queue with no `action_url`, so a click opened `/`.
 * These pin the link the consumer builds, and that a document with no metadata
 * row never gets a link built from its lowercased id.
 */
import { describe, expect, it } from 'bun:test'

import {
  type ChatActionUrlLookups,
  type ChatPushFields,
  resolveChatActionUrl
} from '../../src/lib/push/chatActionUrl'

const APP_URL = 'https://docs.plus'
const DOC_ID = 'V6a648b3056yMseWrj1'

const payload = (over: Partial<ChatPushFields> = {}): ChatPushFields => ({
  notification_id: 'notif-1',
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
    expect(await resolveChatActionUrl(payload(), APP_URL, lookups('api-docs'))).toBe(
      'https://docs.plus/api-docs?chatroom=heading-1&msg_id=msg-1'
    )
  })

  it('leaves out msg_id when the row names no message', async () => {
    expect(await resolveChatActionUrl(payload(), APP_URL, lookups('api-docs', null))).toBe(
      'https://docs.plus/api-docs?chatroom=heading-1'
    )
  })

  it('keeps the empty link when the document has no metadata row', async () => {
    const url = await resolveChatActionUrl(payload(), APP_URL, lookups(null))
    expect(url).toBe('')
    expect(url).not.toContain(DOC_ID.toLowerCase())
  })

  it('keeps a link the row already carries', async () => {
    const own = 'https://docs.plus/api-docs'
    expect(await resolveChatActionUrl(payload({ action_url: own }), APP_URL, lookups('x'))).toBe(
      own
    )
  })
})
