import type { ProfileData } from '@types'
import { supabaseClient } from '@utils/supabase'

/** What a profile save names. An omitted field keeps its column. */
export interface ProfileChange {
  username?: string
  full_name?: string
  profile_data?: Partial<ProfileData>
}

/** Merges only the given top-level `profile_data` keys; see `update_profile` in SQL. */
export const updateProfile = (change: ProfileChange) =>
  supabaseClient.rpc('update_profile', {
    p_username: change.username,
    p_full_name: change.full_name,
    p_profile_patch: (change.profile_data ?? {}) as Record<string, unknown>
  })
