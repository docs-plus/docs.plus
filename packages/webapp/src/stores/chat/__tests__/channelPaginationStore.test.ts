import { enableMapSet } from 'immer'
import { create } from 'zustand'

import { initialPaginationState } from '@types'

import channelPaginationStore from '../channelPaginationStore'

enableMapSet()

const useTestStore = create<any>(channelPaginationStore as any)

beforeEach(() => {
  useTestStore.setState({ paginationByChannel: new Map() })
})

describe('channelPaginationStore', () => {
  it('returns the initial state for unknown channels via the selector helper', () => {
    expect(useTestStore.getState().getPagination('c1')).toEqual(initialPaginationState)
  })

  it('initPagination seeds cursors and flags from the aggregate RPC', () => {
    useTestStore.getState().initPagination('c1', {
      older_cursor: '2026-05-04T10:00:00Z',
      newer_cursor: '2026-05-04T12:00:00Z',
      has_more_older: true,
      has_more_newer: false
    })

    expect(useTestStore.getState().getPagination('c1')).toMatchObject({
      olderCursor: '2026-05-04T10:00:00Z',
      newerCursor: '2026-05-04T12:00:00Z',
      hasMoreOlder: true,
      hasMoreNewer: false,
      isLoadingOlder: false,
      isLoadingNewer: false
    })
  })

  it('setPaginationLoading flips the per-direction flag', () => {
    useTestStore.getState().setPaginationLoading('c1', 'older', true)
    expect(useTestStore.getState().getPagination('c1').isLoadingOlder).toBe(true)
    useTestStore.getState().setPaginationLoading('c1', 'newer', true)
    expect(useTestStore.getState().getPagination('c1').isLoadingNewer).toBe(true)
  })

  it('applyPage(older) updates olderCursor and hasMoreOlder; preserves newer side', () => {
    useTestStore.getState().initPagination('c1', {
      older_cursor: '2026-05-04T10:00:00Z',
      newer_cursor: '2026-05-04T12:00:00Z',
      has_more_older: true,
      has_more_newer: true
    })

    useTestStore.getState().applyPage('c1', 'older', {
      older_cursor: '2026-05-04T08:00:00Z',
      newer_cursor: '2026-05-04T09:30:00Z',
      has_more_older: false,
      has_more_newer: true
    })

    expect(useTestStore.getState().getPagination('c1')).toMatchObject({
      olderCursor: '2026-05-04T08:00:00Z',
      hasMoreOlder: false,
      newerCursor: '2026-05-04T12:00:00Z',
      hasMoreNewer: true,
      isLoadingOlder: false
    })
  })

  it('applyPage(newer) updates newerCursor and hasMoreNewer; preserves older side', () => {
    useTestStore.getState().initPagination('c1', {
      older_cursor: '2026-05-04T10:00:00Z',
      newer_cursor: '2026-05-04T12:00:00Z',
      has_more_older: true,
      has_more_newer: true
    })

    useTestStore.getState().applyPage('c1', 'newer', {
      older_cursor: '2026-05-04T12:30:00Z',
      newer_cursor: '2026-05-04T14:00:00Z',
      has_more_older: true,
      has_more_newer: false
    })

    expect(useTestStore.getState().getPagination('c1')).toMatchObject({
      olderCursor: '2026-05-04T10:00:00Z',
      hasMoreOlder: true,
      newerCursor: '2026-05-04T14:00:00Z',
      hasMoreNewer: false,
      isLoadingNewer: false
    })
  })

  it('clearPagination removes the channel entry', () => {
    useTestStore.getState().initPagination('c1', {
      older_cursor: null,
      newer_cursor: null,
      has_more_older: false,
      has_more_newer: false
    })
    useTestStore.getState().clearPagination('c1')
    expect(useTestStore.getState().paginationByChannel.has('c1')).toBe(false)
  })
})
