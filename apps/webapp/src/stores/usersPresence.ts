import { Profile as TProfile } from '@types'
import { immer } from 'zustand/middleware/immer'

interface IUsersPresenceStore {
  /** Faces by user id. Only the Presence awareness room writes it (`services/presenceRoom.ts`). */
  usersPresence: Map<string, TProfile>
}

const usersPresence = immer<IUsersPresenceStore>(() => ({
  usersPresence: new Map()
}))

export default usersPresence
