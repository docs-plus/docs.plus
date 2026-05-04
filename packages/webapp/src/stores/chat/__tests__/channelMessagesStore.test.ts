import { enableMapSet } from 'immer'
import { create } from 'zustand'

import type { TMsgRow } from '@types'

import channelMessagesStore from '../channelMessagesStore'

enableMapSet()

const useTestStore = create<any>(channelMessagesStore as any)

const row = (id: string, created_at: string): TMsgRow =>
  ({ id, created_at, content: id, channel_id: 'c1' }) as unknown as TMsgRow

beforeEach(() => {
  useTestStore.setState({ messagesByChannel: new Map() })
})

describe('channelMessagesStore.prependMessages', () => {
  it('places new rows before existing rows in iteration order', () => {
    useTestStore.getState().bulkSetMessages('c1', [row('m2', '2026-05-04T12:00:00Z')])
    useTestStore
      .getState()
      .prependMessages('c1', [row('m0', '2026-05-04T11:00:00Z'), row('m1', '2026-05-04T11:30:00Z')])

    const ids = Array.from(useTestStore.getState().messagesByChannel.get('c1')!.keys())
    expect(ids).toEqual(['m0', 'm1', 'm2'])
  })

  it('skips rows whose id already exists (idempotent)', () => {
    useTestStore
      .getState()
      .bulkSetMessages('c1', [row('m1', '2026-05-04T11:30:00Z'), row('m2', '2026-05-04T12:00:00Z')])
    useTestStore.getState().prependMessages('c1', [row('m1', '2026-05-04T11:30:00Z')])

    const ids = Array.from(useTestStore.getState().messagesByChannel.get('c1')!.keys())
    expect(ids).toEqual(['m1', 'm2'])
  })
})

describe('channelMessagesStore.bulkSetMessages (newer-direction pagination)', () => {
  it('places new rows after existing rows in iteration order', () => {
    useTestStore.getState().bulkSetMessages('c1', [row('m1', '2026-05-04T12:00:00Z')])
    useTestStore.getState().bulkSetMessages('c1', [row('m2', '2026-05-04T13:00:00Z')])

    const ids = Array.from(useTestStore.getState().messagesByChannel.get('c1')!.keys())
    expect(ids).toEqual(['m1', 'm2'])
  })
})
