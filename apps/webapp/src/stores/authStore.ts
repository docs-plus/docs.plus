import type { User } from '@supabase/supabase-js'
import { Profile as TProfile } from '@types'
import createSelectors from '@utils/zustand'
import { create } from 'zustand'

export interface IAuthStore {
  /** The Supabase User. Read email here; the profile query omits it. */
  session: User | null
  profile: TProfile | null
  /** The last profile fetch for this session failed. */
  profileError: boolean
  loading: boolean
  setSession: (session: User | null) => void
  setProfile: (profile: TProfile | null) => void
  setProfileError: (profileError: boolean) => void
  setLoading: (loading: boolean) => void
}

const authStore = create<IAuthStore>((set) => ({
  session: null,
  profile: null,
  profileError: false,
  loading: true,
  setSession: (session) => set({ session, loading: false }),
  setProfile: (profile) => set({ profile, profileError: false }),
  setProfileError: (profileError) => set({ profileError }),
  setLoading: (loading) => set({ loading })
}))

export default authStore

export const useAuthStore = createSelectors(authStore)

/**
 * The signed-in cluster. The session lands before the profile, so a signed-in user never
 * sees Sign in first. A failed profile fetch reads signed out, so no avatar bone waits forever.
 */
export const selectIsSignedIn = (state: IAuthStore): boolean =>
  state.profile?.id ? true : Boolean(state.session?.id) && !state.profileError

/** Settings opens on its skeleton while auth still answers. Signed out, it stays shut. */
export const selectSettingsMayOpen = (state: IAuthStore): boolean =>
  state.loading || selectIsSignedIn(state)
