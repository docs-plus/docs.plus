import { immer } from 'zustand/middleware/immer'

/** Client-predicted unread count per channel; reconciled by channel_members realtime. */
export interface OptimisticUnreadState {
  optimisticUnread: Map<string, number>
  setOptimisticUnread: (channelId: string, value: number | null | undefined) => void
  decrementOptimisticUnread: (channelId: string, by: number, seed: number) => void
  clearOptimisticUnread: (channelId: string) => void
}

const optimisticUnreadStore = immer<OptimisticUnreadState>((set) => ({
  optimisticUnread: new Map(),

  setOptimisticUnread: (channelId, value) =>
    set((state) => {
      if (typeof value !== 'number') return
      state.optimisticUnread.set(channelId, Math.max(0, value))
    }),

  decrementOptimisticUnread: (channelId, by, seed) =>
    set((state) => {
      if (by <= 0) return
      const current = state.optimisticUnread.get(channelId) ?? seed
      state.optimisticUnread.set(channelId, Math.max(0, current - by))
    }),

  clearOptimisticUnread: (channelId) =>
    set((state) => {
      state.optimisticUnread.delete(channelId)
    })
}))

export default optimisticUnreadStore
