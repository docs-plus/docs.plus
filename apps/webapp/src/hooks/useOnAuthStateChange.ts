import { applySignedInProfile } from '@components/auth/applySignedInProfile'
import { handleAuthLanding } from '@components/auth/authLanding'
import { useAuthStore } from '@stores'
import type { User } from '@supabase/supabase-js'
import { trackSignUpOnce } from '@utils/analytics'
import { writeAppBadge } from '@utils/appBadge'
import { setObservabilityUser } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useEffect } from 'react'

import { clearMediaSession, postMediaSession, retryMediaAfterSession } from './mediaSession'
import { useLocationHash } from './useLocationHash'

export const useOnAuthStateChange = () => {
  const setLoading = useAuthStore((state) => state.setLoading)
  const locationHash = useLocationHash()

  // A link pasted into a tab already on its page changes only the hash, so rerun on it.
  useEffect(() => {
    handleAuthLanding()
  }, [locationHash])

  const getUserProfile = useCallback(
    async (user: User) => {
      await applySignedInProfile(user)
      setLoading(false)
    },
    [setLoading]
  )

  useEffect(() => {
    setLoading(true)
    const stopMediaRetry = retryMediaAfterSession()
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
        session?.access_token
      ) {
        postMediaSession(session.access_token)
      }

      if (event === 'SIGNED_IN') {
        trackSignUpOnce(session)
        // Identity only — profile refetch stays gated to INITIAL_SESSION/USER_UPDATED.
        setObservabilityUser(session?.user?.id ?? null)
      }

      // SIGNED_IN stays out of this branch. auth-js re-emits it on tab focus
      // and beside INITIAL_SESSION on PKCE return. An identity guard cannot
      // separate those: both see a null profile and both fetch. Sign-in
      // hydrates at its own call site instead.
      if (/*event === 'SIGNED_IN' ||*/ event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (!session?.user) {
          setLoading(false)
          return
        }
        useAuthStore.getState().setSession(session.user)
        setObservabilityUser(session.user.id)
        getUserProfile(session.user)
      }
      if (event === 'SIGNED_OUT') {
        // The bell hook stops at a null profile, so it never zeroes the app icon.
        writeAppBadge(0)
        // Every sign-out path and every other tab lands here.
        void clearMediaSession()
        setObservabilityUser(null)
        useAuthStore.getState().setSession(null)
        useAuthStore.getState().setProfile(null)
        setLoading(false)
      }
    })

    // No `offline` unsubscribe here. It used to tear the subscription down for
    // good — nothing re-subscribed on `online` — so one blip left the app deaf to
    // every later auth event. A full reload used to hide that; it no longer does.
    return () => {
      data.subscription.unsubscribe()
      stopMediaRetry()
    }
  }, [getUserProfile, setLoading])
}
