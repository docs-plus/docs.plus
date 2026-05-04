import { act, renderHook } from '@testing-library/react'
import { enableMapSet } from 'immer'

import { markReadMessages } from '@api'
import { useChatStore } from '@stores'

import { useReadReceipts } from '../useReadReceipts'

enableMapSet()

jest.mock('@api', () => ({
  markReadMessages: jest.fn().mockResolvedValue(null)
}))

jest.mock('@components/chatroom/components/MessageFeed/MessageFeedContext', () => {
  const containerRef = { current: null as HTMLElement | null }
  const virtualizerRef = { current: null as any }
  return {
    useMessageFeedContext: () => ({
      messageContainerRef: containerRef,
      virtualizerRef,
      topSentinelRef: { current: null },
      bottomSentinelRef: { current: null },
      registerVirtualizer: jest.fn(),
      scrollState: { mode: 'pinned-to-bottom' },
      scrollToBottom: jest.fn(),
      scrollToMessage: jest.fn(),
      isLoadingOlder: false,
      isLoadingNewer: false
    }),
    __setRefs: (container: HTMLElement, virtualizer: any) => {
      containerRef.current = container
      virtualizerRef.current = virtualizer
    }
  }
})

const ctxModule = require('@components/chatroom/components/MessageFeed/MessageFeedContext')

const PROFILE = { id: 'me' } as any

const setLastRead = (iso: string | undefined) => {
  useChatStore.setState({
    workspaceSettings: {
      ...useChatStore.getState().workspaceSettings,
      channels: new Map([['c1', { lastReadMessageTimestamp: iso ? new Date(iso) : undefined }]])
    }
  } as any)
}

const fakeVirtualizer = (visibleIndexes: number[]) => {
  const scrollEl: any = {
    scrollTop: 0,
    clientHeight: 600,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }
  return {
    getVirtualItems: () =>
      visibleIndexes.map((index) => ({
        index,
        key: `m${index}`,
        start: index * 100,
        end: (index + 1) * 100
      })),
    scrollOffset: 0,
    scrollElement: scrollEl
  }
}

const messages = [
  { id: 'm0', user_id: 'peer', created_at: '2026-05-04T10:00:00Z' },
  { id: 'm1', user_id: 'peer', created_at: '2026-05-04T11:00:00Z' },
  { id: 'm2', user_id: 'peer', created_at: '2026-05-04T12:00:00Z', status: 'pending' },
  { id: 'm3', user_id: 'peer', created_at: '2026-05-04T13:00:00Z' }
] as any

describe('useReadReceipts', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(markReadMessages as jest.Mock).mockClear()
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    ctxModule.__setRefs(container, fakeVirtualizer([0, 1, 2, 3]))
    setLastRead('2026-05-04T09:00:00Z')
  })

  afterEach(() => jest.useRealTimers())

  it('marks the newest non-pending visible message as read (skips pending m2 → picks m3)', () => {
    renderHook(() => useReadReceipts({ channelId: 'c1', messages, profile: PROFILE }))

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(markReadMessages).toHaveBeenCalledTimes(1)
    expect(markReadMessages).toHaveBeenCalledWith({ channelId: 'c1', lastMessage: 'm3' })
  })

  it('does NOT advance the read cursor when only a pending message is visible', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    ctxModule.__setRefs(container, fakeVirtualizer([2]))

    renderHook(() => useReadReceipts({ channelId: 'c1', messages, profile: PROFILE }))

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(markReadMessages).not.toHaveBeenCalled()
  })

  it('skips messages older than lastReadMessageTimestamp', () => {
    setLastRead('2026-05-04T13:30:00Z')
    renderHook(() => useReadReceipts({ channelId: 'c1', messages, profile: PROFILE }))

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(markReadMessages).not.toHaveBeenCalled()
  })

  it('flushes only once per stable resting position (debounce coalescing)', () => {
    const { rerender } = renderHook(
      ({ msgs }: { msgs: typeof messages }) =>
        useReadReceipts({ channelId: 'c1', messages: msgs, profile: PROFILE }),
      { initialProps: { msgs: messages.slice(0, 2) } }
    )

    rerender({ msgs: messages.slice(0, 3) })
    rerender({ msgs: messages })

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(markReadMessages).toHaveBeenCalledTimes(1)
  })

  it('does NOT write lastReadMessageId locally (server owns it)', () => {
    renderHook(() => useReadReceipts({ channelId: 'c1', messages, profile: PROFILE }))

    act(() => {
      jest.advanceTimersByTime(250)
    })

    const settings = useChatStore.getState().workspaceSettings.channels.get('c1') as any
    expect(settings?.lastReadMessageId).toBeUndefined()
    expect(settings?.lastReadMessageTimestamp).toBeDefined()
  })
})
