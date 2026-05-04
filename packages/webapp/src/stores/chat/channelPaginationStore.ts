import {
  initialPaginationState,
  TPaginationCursors,
  TPaginationDirection,
  TPaginationState
} from '@types'
import { immer } from 'zustand/middleware/immer'

interface IChannelPaginationStore {
  paginationByChannel: Map<string, TPaginationState>
  getPagination: (channelId: string) => TPaginationState
  initPagination: (channelId: string, cursors: TPaginationCursors) => void
  applyPage: (
    channelId: string,
    direction: TPaginationDirection,
    cursors: TPaginationCursors
  ) => void
  setPaginationLoading: (
    channelId: string,
    direction: TPaginationDirection,
    isLoading: boolean
  ) => void
  clearPagination: (channelId: string) => void
}

const cursorsToState = (c: TPaginationCursors): TPaginationState => ({
  olderCursor: c.older_cursor,
  newerCursor: c.newer_cursor,
  hasMoreOlder: c.has_more_older,
  hasMoreNewer: c.has_more_newer,
  isLoadingOlder: false,
  isLoadingNewer: false
})

const channelPaginationStore = immer<IChannelPaginationStore>((set, get) => ({
  paginationByChannel: new Map(),

  getPagination: (channelId) => get().paginationByChannel.get(channelId) ?? initialPaginationState,

  initPagination: (channelId, cursors) => {
    set((state) => {
      state.paginationByChannel.set(channelId, cursorsToState(cursors))
    })
  },

  applyPage: (channelId, direction, cursors) => {
    set((state) => {
      const existing = state.paginationByChannel.get(channelId) ?? { ...initialPaginationState }
      if (direction === 'older') {
        existing.olderCursor = cursors.older_cursor ?? existing.olderCursor
        existing.hasMoreOlder = cursors.has_more_older
        existing.isLoadingOlder = false
      } else {
        existing.newerCursor = cursors.newer_cursor ?? existing.newerCursor
        existing.hasMoreNewer = cursors.has_more_newer
        existing.isLoadingNewer = false
      }
      state.paginationByChannel.set(channelId, existing)
    })
  },

  setPaginationLoading: (channelId, direction, isLoading) => {
    set((state) => {
      const existing = state.paginationByChannel.get(channelId) ?? { ...initialPaginationState }
      if (direction === 'older') existing.isLoadingOlder = isLoading
      else existing.isLoadingNewer = isLoading
      state.paginationByChannel.set(channelId, existing)
    })
  },

  clearPagination: (channelId) => {
    set((state) => {
      state.paginationByChannel.delete(channelId)
    })
  }
}))

export default channelPaginationStore
