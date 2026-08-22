import { getUserById } from '@api'
import * as toast from '@components/toast'
import { useAuthStore } from '@stores'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@types'
import { supabaseClient } from '@utils/supabase'

import { rememberSignedInAccount } from './lastSignedInAccount'

export type SignedInProfileOutcome = 'signed-in' | 'profile-missing' | 'profile-error'

/**
 * Call-site hydration for Option A: `onAuthStateChange` ignores SIGNED_IN.
 * `error` is transient; a null row is the missing-row rule and must sign out.
 */
export async function applySignedInProfile(user: User): Promise<SignedInProfileOutcome> {
  useAuthStore.getState().setSession(user)

  const { data: profile, error: profileError } = await getUserById(user.id)
  if (profileError) return 'profile-error'
  if (!profile) {
    console.warn('No public.users row for authenticated user; signing out.')
    await supabaseClient.auth.signOut()
    return 'profile-missing'
  }

  const next = { ...profile, status: 'ONLINE' } as Profile
  useAuthStore.getState().setProfile(next)
  rememberSignedInAccount(next, user.email)
  return 'signed-in'
}

export function announceSignedInProfile(outcome: SignedInProfileOutcome): void {
  switch (outcome) {
    case 'signed-in':
      return
    case 'profile-error':
      toast.Error('Signed in, but your profile did not load. Please refresh the page.')
      return
    case 'profile-missing':
      toast.Error('This account is not set up yet. Please sign in again.')
      return
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}
