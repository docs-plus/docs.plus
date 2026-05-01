import { useChatStore, useStore } from '@stores'

import { messageInsert } from './messageInsert'

jest.mock('@api', () => ({
  getUserById: jest.fn(async () => ({ data: null, error: null }))
}))

const seedUserPresence = (id: string) => {
  useStore.setState((state) => ({
    ...state,
    usersPresence: new Map(state.usersPresence).set(id, {
      id,
      username: 'tester',
      avatar_url: null
    } as any)
  }))
}

const newPayload = (overrides: Record<string, unknown>) => ({
  new: {
    id: 'msg-1',
    channel_id: 'c1',
    user_id: 'u1',
    content: 'hello',
    html: '<p>hello</p>',
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-01T10:00:00Z',
    deleted_at: null,
    type: 'text',
    ...overrides
  }
})

describe('messageInsert (idempotent upsert)', () => {
  beforeEach(() => {
    useChatStore.setState((state) => ({
      ...state,
      messagesByChannel: new Map()
    }))
    seedUserPresence('u1')
  })

  it('adds a new message with status=sent', async () => {
    await messageInsert(newPayload({}))
    const row = useChatStore.getState().messagesByChannel.get('c1')?.get('msg-1')
    expect(row).toBeDefined()
    expect(row?.status).toBe('sent')
    expect(row?.user_details?.id).toBe('u1')
  })

  it('upgrades a pending optimistic row to sent in place', async () => {
    useChatStore.getState().setOrUpdateMessage('c1', 'msg-1', {
      id: 'msg-1',
      channel_id: 'c1',
      user_id: 'u1',
      content: 'hello',
      created_at: '2026-05-01T10:00:00Z',
      status: 'pending'
    })

    await messageInsert(newPayload({}))
    const row = useChatStore.getState().messagesByChannel.get('c1')?.get('msg-1')
    expect(row?.status).toBe('sent')
    expect(row?.statusError).toBeUndefined()
  })

  it('does not collide when two pending messages echo back', async () => {
    useChatStore.getState().setOrUpdateMessage('c1', 'msg-A', {
      id: 'msg-A',
      channel_id: 'c1',
      user_id: 'u1',
      content: 'A',
      status: 'pending'
    })
    useChatStore.getState().setOrUpdateMessage('c1', 'msg-B', {
      id: 'msg-B',
      channel_id: 'c1',
      user_id: 'u1',
      content: 'B',
      status: 'pending'
    })

    await messageInsert(newPayload({ id: 'msg-A', content: 'A' }))
    await messageInsert(newPayload({ id: 'msg-B', content: 'B' }))

    const channel = useChatStore.getState().messagesByChannel.get('c1')!
    expect(channel.get('msg-A')?.status).toBe('sent')
    expect(channel.get('msg-B')?.status).toBe('sent')
    expect(channel.size).toBe(2)
  })

  it('ignores soft-deleted payloads', async () => {
    await messageInsert(newPayload({ deleted_at: '2026-05-01T11:00:00Z' }))
    const channel = useChatStore.getState().messagesByChannel.get('c1')
    expect(channel?.size ?? 0).toBe(0)
  })
})
