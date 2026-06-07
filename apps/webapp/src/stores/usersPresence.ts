import { Profile as TProfile } from '@types'
import { immer } from 'zustand/middleware/immer'

type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'INVISIBLE' | 'TYPING'

interface IUsersPresenceStore {
  usersPresence: Map<string, TProfile>
  setOrUpdateUserPresence: (userId: string, userData: TProfile) => void
  updateUserStatus: (userId: string, status: UserStatus) => void
  /** Reset the map — used when swapping realtime subscriptions (e.g. anon→authed). */
  clearUsersPresence: () => void
}

const usersPresence = immer<IUsersPresenceStore>((set) => ({
  usersPresence: new Map(),

  // New Map reference per write so consumers' useEffect/useMemo deps fire — in-place mutation
  // keeps the same reference and selectors don't notice the change.
  setOrUpdateUserPresence: (userId, userData) => {
    set((state) => {
      const next = new Map(state.usersPresence)
      next.set(userId, userData)
      state.usersPresence = next
    })
  },

  updateUserStatus: (userId, status) => {
    set((state) => {
      const user = state.usersPresence.get(userId)
      if (!user) return
      const next = new Map(state.usersPresence)
      next.set(userId, { ...user, status })
      state.usersPresence = next
    })
  },

  clearUsersPresence: () => {
    set((state) => {
      state.usersPresence = new Map()
    })
  }
}))

export default usersPresence
