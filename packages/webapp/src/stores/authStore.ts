import createSelectors from '@utils/zustand'
import { create } from 'zustand'
import { Database, Profile as TProfile } from '@types'

export interface IAuthStore {
  session: any | null
  profile: TProfile | null
  loading: boolean
  setSession: (session: any) => void
  setProfile: (profile: TProfile | null) => void
  setLoading: (loading: boolean) => void
}

const authStore = create<IAuthStore>((set) => ({
  session: null,
  profile: null,
  loading: true,
  setSession: (session) => set({ session, loading: false }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading })
}))

export default authStore

export const useAuthStore = createSelectors(authStore)
