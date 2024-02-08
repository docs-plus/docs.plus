import createSelectors from '@utils/zustand'
import { create } from 'zustand'
import { Database } from '@types'

type TProfile = Database['public']['Tables']['users']['Row']

export interface IAuthStore {
  session: object | null
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
