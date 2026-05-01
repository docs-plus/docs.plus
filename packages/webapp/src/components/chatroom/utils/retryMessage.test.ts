import { useAuthStore, useChatStore } from '@stores'

import { retryMessage } from './retryMessage'

const sendMessageMock = jest.fn()
const createThreadMessageMock = jest.fn()

jest.mock('@api', () => ({
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  createThreadMessage: (...args: unknown[]) => createThreadMessageMock(...args)
}))

const seedFailedRow = (overrides: Record<string, unknown> = {}) => {
  const row = {
    id: 'msg-1',
    channel_id: 'c1',
    user_id: 'u1',
    content: 'hi',
    html: '<p>hi</p>',
    status: 'failed',
    statusError: 'network',
    reply_to_message_id: null,
    thread_id: null,
    ...overrides
  }
  useChatStore.getState().setOrUpdateMessage(row.channel_id as string, row.id, row as any)
  return row
}

describe('retryMessage', () => {
  beforeEach(() => {
    sendMessageMock.mockReset()
    createThreadMessageMock.mockReset()
    useChatStore.setState((s) => ({ ...s, messagesByChannel: new Map() }))
    useAuthStore.setState((s) => ({ ...s, profile: { id: 'u1', username: 'me' } as any }))
  })

  it('flips a failed row to pending then sent on success', async () => {
    seedFailedRow()
    sendMessageMock.mockResolvedValue({
      data: [{ id: 'msg-1', content: 'hi', created_at: '2026-05-01T10:00:00Z' }]
    })

    await retryMessage('c1', 'msg-1')

    const row = useChatStore.getState().messagesByChannel.get('c1')?.get('msg-1')
    expect(row?.status).toBe('sent')
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg-1', content: 'hi' })
    )
  })

  it('re-flips to failed on a second error and preserves the new error message', async () => {
    seedFailedRow()
    sendMessageMock.mockRejectedValue(new Error('still down'))

    await retryMessage('c1', 'msg-1')

    const row = useChatStore.getState().messagesByChannel.get('c1')?.get('msg-1')
    expect(row?.status).toBe('failed')
    expect(row?.statusError).toBe('still down')
  })

  it('routes thread messages through createThreadMessage', async () => {
    seedFailedRow({ thread_id: 'c1' })
    createThreadMessageMock.mockResolvedValue({ data: null, error: null })

    await retryMessage('c1', 'msg-1')

    expect(createThreadMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ p_id: 'msg-1', p_thread_id: 'c1' })
    )
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('is a no-op for rows that are not failed', async () => {
    seedFailedRow({ status: 'pending' })
    await retryMessage('c1', 'msg-1')
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('is a no-op when the row has been removed', async () => {
    await retryMessage('c1', 'missing')
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('is a no-op without an authenticated user', async () => {
    seedFailedRow()
    useAuthStore.setState((s) => ({ ...s, profile: null }))
    await retryMessage('c1', 'msg-1')
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it('treats Postgres 23505 duplicate-key as success', async () => {
    seedFailedRow()
    sendMessageMock.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint "messages_pkey"'), {
        code: '23505'
      })
    )

    await retryMessage('c1', 'msg-1')

    const row = useChatStore.getState().messagesByChannel.get('c1')?.get('msg-1')
    expect(row?.status).toBe('sent')
    expect(row?.statusError).toBeUndefined()
  })

  it('treats duplicate-key by message text alone as success', async () => {
    seedFailedRow()
    sendMessageMock.mockRejectedValue(
      new Error('insert into messages failed: duplicate key on messages_pkey')
    )

    await retryMessage('c1', 'msg-1')
    expect(useChatStore.getState().messagesByChannel.get('c1')?.get('msg-1')?.status).toBe('sent')
  })

  it('is safe under rapid double-invocation', async () => {
    seedFailedRow()
    let resolveSend: (v: unknown) => void = () => {}
    sendMessageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve
        })
    )

    const first = retryMessage('c1', 'msg-1')
    const second = retryMessage('c1', 'msg-1')

    expect(sendMessageMock).toHaveBeenCalledTimes(1)

    resolveSend({ data: [{ id: 'msg-1' }] })
    await Promise.all([first, second])

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(useChatStore.getState().messagesByChannel.get('c1')?.get('msg-1')?.status).toBe('sent')
  })
})
