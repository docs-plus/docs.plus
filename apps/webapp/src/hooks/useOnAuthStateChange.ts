import { applySignedInProfile } from '@components/auth/applySignedInProfile'
import * as toast from '@components/toast'
import { useAuthStore } from '@stores'
import type { User } from '@supabase/supabase-js'
import { trackSignUpOnce } from '@utils/analytics'
import { captureUnknown, setObservabilityUser } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useEffect } from 'react'

let pkceFailureHandled = false

// supabase-js auto-exchanges ?code= on load but swallows network failures
// (Safari "Load failed"), and strips the URL only on success. The user is left
// on a stale /?code=, silently signed out. The initialize() call is idempotent
// and resolves { error } instead of rejecting, so it is the highest catchable layer.
const reportPkceExchangeFailure = () => {
  if (pkceFailureHandled || !new URLSearchParams(window.location.search).has('code')) return
  pkceFailureHandled = true
  supabaseClient.auth.initialize().then(({ error }) => {
    if (!error) return
    captureUnknown(error, { tags: { surface: 'auth-pkce' } })
    const url = new URL(window.location.href)
    url.searchParams.delete('code')
    window.history.replaceState(window.history.state, '', url.toString())
    toast.Error('Sign-in could not be completed. Please try signing in again.')
  })
}

export const useOnAuthStateChange = () => {
  const setLoading = useAuthStore((state) => state.setLoading)

  const getUserProfile = useCallback(
    async (user: User) => {
      await applySignedInProfile(user)
      setLoading(false)
    },
    [setLoading]
  )

  useEffect(() => {
    if (!navigator.onLine) {
      setLoading(false)
      return
    }

    setLoading(true)
    reportPkceExchangeFailure()
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (!navigator.onLine) {
        setLoading(false)
        return
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
    }
  }, [getUserProfile, setLoading])
}
