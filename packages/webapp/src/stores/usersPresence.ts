import { immer } from 'zustand/middleware/immer'
import { Profile as TProfile } from '@types'

type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'INVISIBLE' | 'TYPING'

interface IUsersPresenceStore {
  usersPresence: Map<string, TProfile>
  setOrUpdateUserPresence: (userId: string, userData: TProfile) => void
  removeUserPresence: (userId: string) => void
  clearUsersPresence: () => void
  bulkSetUsersPresence: (users: Map<string, any>) => void
  updateUserStatus: (userId: string, status: UserStatus) => void
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
      state.usersPresence.clear()
    })
  },

  bulkSetUsersPresence: (users) => {
    set((state) => {
      users.forEach((user, userId) => {
        state.usersPresence.set(userId, user)
      })
    })
  },

  updateUserStatus: (userId, status) => {
    set((state) => {
      const user = state.usersPresence.get(userId)
      if (user) {
        state.usersPresence.set(userId, { ...user, status })
      }
    })
  }
}))

export default usersPresence
