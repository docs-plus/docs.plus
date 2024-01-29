import { immer } from 'zustand/middleware/immer'
import { Database } from '@types'

export type TProfile = Database['public']['Tables']['users']['Row']

interface IUsersPresenceStore {
  usersPresence: Map<string, TProfile>
  setOrUpdateUserPresence: (userId: string, userData: TProfile) => void
  removeUserPresence: (userId: string) => void
  clearUsersPresence: () => void
  bulkSetUsersPresence: (users: Map<string, any>) => void
}

const usersPresence = immer<IUsersPresenceStore>((set) => ({
  usersPresence: new Map(),

  setOrUpdateUserPresence: (userId, userData) => {
    set((state) => {
      state.usersPresence.set(userId, userData)
    })
  },

  removeUserPresence: (userId) => {
    set((state) => {
      state.usersPresence.delete(userId)
    })
  },

  clearUsersPresence: () => {
    set((state) => {
      state.usersPresence = new Map()
    })
  },

  bulkSetUsersPresence: (users) => {
    set((state) => {
      users.forEach((user, userId) => {
        state.usersPresence.set(userId, user)
      })
    })
  }
}))

export default usersPresence
