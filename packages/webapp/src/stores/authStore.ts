import { Profile as TProfile } from '@types'
import createSelectors from '@utils/zustand'
import { create } from 'zustand'

export interface IAuthStore {
  session: any | null
  profile: TProfile | null
  loading: boolean
  isAnonymous: boolean
  setSession: (session: any, isAnonymous?: boolean) => void
  setProfile: (profile: TProfile | null) => void
  setLoading: (loading: boolean) => void
}

const authStore = create<IAuthStore>((set) => ({
  session: null,
  profile: null,
  loading: true,
  isAnonymous: false,
  setSession: (session, isAnonymous = false) => set({ session, isAnonymous, loading: false }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading })
}))

export default authStore

export const useAuthStore = createSelectors(authStore)
