import { getUserById } from '@api'
import * as toast from '@components/toast'
import { useApi } from '@hooks/useApi'
import { useAuthStore } from '@stores'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@types'
import { trackSignUpOnce } from '@utils/analytics'
import { ensureAnonymousSession, resetAnonymousSessionGate } from '@utils/ensureAnonymousSession'
import { captureUnknown, setObservabilityUser } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useEffect } from 'react'

let pkceFailureHandled = false

// supabase-js auto-exchanges ?code= on load but swallows network failures
// (Safari "Load failed"), stripping the URL only on success — the user is left
// on a stale /?code= silently signed out. initialize() is idempotent and
// resolves { error } instead of rejecting, so it is the highest catchable layer.
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

interface UseOnAuthStateChangeOptions {
  deferAnonymousAuth: boolean
}

export const useOnAuthStateChange = ({ deferAnonymousAuth }: UseOnAuthStateChangeOptions) => {
  const setLoading = useAuthStore((state) => state.setLoading)
  const { request: getUserByIdRequest } = useApi(getUserById, null, false)

  const getUserProfile = useCallback(
    async (user: User) => {
      const { data, error } = await getUserByIdRequest(user.id)
      if (error) throw error
      if (!data) {
        console.warn('No public.users row for authenticated user; signing out.')
        await supabaseClient.auth.signOut()
        return
      }
      useAuthStore.getState().setProfile({ ...data, status: 'ONLINE' } as Profile)
      setLoading(false)
    },
    [getUserByIdRequest, setLoading]
  )

  const bootstrapAnonymousSession = useCallback(async () => {
    try {
      await ensureAnonymousSession()
      if (!useAuthStore.getState().profile) {
        setLoading(false)
      }
    } catch (err) {
      console.warn('Anonymous sign-in error:', err)
      setLoading(false)
    }
  }, [setLoading])

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

      if (event === 'INITIAL_SESSION') {
        if (!session?.user) {
          if (deferAnonymousAuth) {
            setLoading(false)
            return
          }
          bootstrapAnonymousSession()
          return
        }
      }
      if (/*event === 'SIGNED_IN' ||*/ event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (!session?.user) {
          setLoading(false)
          return
        }
        const isAnonymous = session?.user?.is_anonymous || false
        useAuthStore.getState().setSession(session?.user || null, isAnonymous)
        setObservabilityUser(session?.user?.id ?? null)

        if (session?.user && !isAnonymous) {
          getUserProfile(session.user)
        } else {
          setLoading(false)
        }
      }
      if (event === 'SIGNED_OUT') {
        setObservabilityUser(null)
        useAuthStore.getState().setSession(null, false)
        useAuthStore.getState().setProfile(null)
        setLoading(false)
        resetAnonymousSessionGate()
      }
    })

    const handleOffline = () => {
      data.subscription.unsubscribe()
    }

    window.addEventListener('offline', handleOffline)

    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener('offline', handleOffline)
    }
  }, [bootstrapAnonymousSession, deferAnonymousAuth, getUserProfile, setLoading])
}
