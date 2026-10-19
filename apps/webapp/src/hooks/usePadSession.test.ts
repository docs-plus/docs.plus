import { useChatStore, useStore } from '@stores'
import { act, renderHook } from '@testing-library/react'

import usePadSession from './usePadSession'

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void }
function mockDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const mockChannelCalls: Array<{ documentId: string; answer: Deferred<{ data: unknown[] }> }> = []
const mockJoinCalls: Array<{ documentId: string; answer: Deferred<{ error: unknown }> }> = []

jest.mock('@api', () => ({
  getChannels: (documentId: string) => {
    const answer = mockDeferred<{ data: unknown[] }>()
    mockChannelCalls.push({ documentId, answer })
    return answer.promise
  },
  getChannelsWithMessageCounts: jest.fn(),
  joinWorkspace: ({ workspaceId }: { workspaceId: string }) => {
    const answer = mockDeferred<{ error: unknown }>()
    mockJoinCalls.push({ documentId: workspaceId, answer })
    return answer.promise
  }
}))

// The real helper pulls in the composer. The path is relative, because that is the file
// Jest resolves `@services/openHeadingChatroom` to.
jest.mock('../services/openHeadingChatroom', () => ({ closeOpenChatRoom: () => {} }))
jest.mock('./useTouchDocumentOpened', () => () => {})
jest.mock('@utils/logger', () => ({ logger: { error: () => {} } }))

jest.mock('@stores', () => {
  const { create: createStore } = jest.requireActual('zustand')
  const useAuthStore = createStore(() => ({ profile: { id: 'u1' }, loading: false }))
  const useChatStore = createStore((set: any) => ({
    channels: new Map(),
    clearAndInitialChannels: () => set({ channels: new Map() }),
    bulkSetChannels: (rows: Array<{ id: string }>) =>
      set((s: any) => ({ channels: new Map([...s.channels, ...rows.map((r) => [r.id, r])]) }))
  }))
  const useStore = createStore((set: any) => ({
    settings: { workspaceJoin: 'pending' },
    setWorkspaceSetting: (key: string, value: unknown) =>
      set((s: any) => ({ settings: { ...s.settings, [key]: value } })),
    setWorkspaceSettings: (partial: object) =>
      set((s: any) => ({ settings: { ...s.settings, ...partial } }))
  }))
  return { useAuthStore, useChatStore, useStore }
})

const pad = (documentId: string) => ({
  documentId,
  slug: documentId,
  title: '',
  isPrivate: false,
  keywords: [],
  docClientId: ''
})
const flush = () => act(async () => {})
const lastFor = <T extends { documentId: string }>(calls: T[], documentId: string) =>
  calls.filter((c) => c.documentId === documentId).at(-1)!
const channelIds = () => [...useChatStore.getState().channels.keys()]

beforeEach(() => {
  mockChannelCalls.length = 0
  mockJoinCalls.length = 0
  useStore.setState({ settings: { workspaceJoin: 'pending' } } as never)
  useChatStore.setState({ channels: new Map() } as never)
})

describe('usePadSession', () => {
  it('never marks B joined from a late join answer for A', async () => {
    const { rerender } = renderHook(({ doc }) => usePadSession(doc), {
      initialProps: { doc: pad('A') }
    })
    await act(async () => lastFor(mockChannelCalls, 'A').answer.resolve({ data: [] }))
    expect(lastFor(mockJoinCalls, 'A')).toBeDefined()

    rerender({ doc: pad('B') })
    await act(async () => lastFor(mockChannelCalls, 'B').answer.resolve({ data: [] }))
    await act(async () => lastFor(mockJoinCalls, 'A').answer.resolve({ error: null }))
    expect(useStore.getState().settings.workspaceJoin).toBe('pending')

    await act(async () => lastFor(mockJoinCalls, 'B').answer.resolve({ error: null }))
    expect(useStore.getState().settings.workspaceJoin).toBe('joined')
  })

  it('drops a late channel answer for B after a quick A to B to A', async () => {
    const { rerender } = renderHook(({ doc }) => usePadSession(doc), {
      initialProps: { doc: pad('A') }
    })
    await act(async () => lastFor(mockChannelCalls, 'A').answer.resolve({ data: [{ id: 'a1' }] }))
    expect(channelIds()).toEqual(['a1'])

    rerender({ doc: pad('B') })
    await flush()
    rerender({ doc: pad('A') })
    await flush()
    expect(channelIds()).toEqual([])

    await act(async () => lastFor(mockChannelCalls, 'B').answer.resolve({ data: [{ id: 'b1' }] }))
    expect(channelIds()).toEqual([])
    await act(async () => lastFor(mockChannelCalls, 'A').answer.resolve({ data: [{ id: 'a1' }] }))
    expect(channelIds()).toEqual(['a1'])
  })
})
