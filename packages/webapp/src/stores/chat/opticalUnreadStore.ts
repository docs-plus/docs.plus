import { immer } from 'zustand/middleware/immer'

/** Client-predicted unread count per channel; reconciled by channel_members realtime. */
export interface OpticalUnreadState {
  opticalUnread: Map<string, number>
  setOpticalUnread: (channelId: string, value: number | null | undefined) => void
  decrementOpticalUnread: (channelId: string, by: number, seed: number) => void
  clearOpticalUnread: (channelId: string) => void
}

const opticalUnreadStore = immer<OpticalUnreadState>((set) => ({
  opticalUnread: new Map(),

  setOpticalUnread: (channelId, value) =>
    set((state) => {
      if (typeof value !== 'number') return
      state.opticalUnread.set(channelId, Math.max(0, value))
    }),

  decrementOpticalUnread: (channelId, by, seed) =>
    set((state) => {
      if (by <= 0) return
      const current = state.opticalUnread.get(channelId) ?? seed
      state.opticalUnread.set(channelId, Math.max(0, current - by))
    }),

  clearOpticalUnread: (channelId) =>
    set((state) => {
      state.opticalUnread.delete(channelId)
    })
}))

export default opticalUnreadStore
