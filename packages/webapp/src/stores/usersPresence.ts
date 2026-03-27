import { Profile as TProfile } from '@types'
import { immer } from 'zustand/middleware/immer'

type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'INVISIBLE' | 'TYPING'

interface IUsersPresenceStore {
  usersPresence: Map<string, TProfile>
  setOrUpdateUserPresence: (userId: string, userData: TProfile) => void
  updateUserStatus: (userId: string, status: UserStatus) => void
}

const usersPresence = immer<IUsersPresenceStore>((set) => ({
  usersPresence: new Map(),

  setOrUpdateUserPresence: (userId, userData) => {
    set((state) => {
      state.usersPresence.set(userId, userData)
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
