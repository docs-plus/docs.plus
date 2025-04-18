import createSelectors from '@utils/zustand'
import { create } from 'zustand'
import { Database, Profile as TProfile } from '@types'

export interface IAuthStore {
  session: any | null
  profile: TProfile | null
  loading: boolean
  displayName?: string | null
  setSession: (session: any) => void
  setProfile: (profile: TProfile | null) => void
  setLoading: (loading: boolean) => void
  setDisplayName: (displayName: string) => void
}

const authStore = create<IAuthStore>((set) => ({
  session: null,
  profile: null,
  loading: true,
  displayName: null,
  setSession: (session) => set({ session, loading: false }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setDisplayName: (displayName) => set({ displayName })
}))

export default authStore

export const useAuthStore = createSelectors(authStore)
