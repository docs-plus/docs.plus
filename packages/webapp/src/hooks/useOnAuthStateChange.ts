import { getUserById } from '@api'
import { useApi } from '@hooks/useApi'
import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useEffect, useRef } from 'react'

export const useOnAuthStateChange = () => {
  const setLoading = useAuthStore((state) => state.setLoading)
  const { request: getUserByIdRequest } = useApi(getUserById, null, false)
  const anonymousSignInAttempted = useRef(false)

  const getUserProfile = useCallback(
    async (user: any) => {
      const { data, error } = (await getUserByIdRequest(user.id)) as any
      if (error) throw error
      useAuthStore.getState().setProfile({ ...data, status: 'ONLINE' })
      setLoading(false)
    },
    [getUserByIdRequest, setLoading]
  )

  /**
   * Sign in anonymously if no session exists.
   * Anonymous users get a persistent user_id that can be linked to a real account later.
   * @see https://supabase.com/docs/guides/auth/auth-anonymous
   *
   * The success path resolves the auth-loading state synchronously via
   * `setSession(data.user, true)` (which sets `loading: false` in the store).
   * Do NOT rely on the post-signin `SIGNED_IN` event — the
   * `onAuthStateChange` handler below intentionally omits SIGNED_IN from
   * its branches to avoid re-fetching the profile on every tab focus /
   * token refresh in older Supabase versions, so the event has no
   * listener and the loading state would stick forever.
   */
  const signInAnonymously = useCallback(async () => {
    // Prevent multiple attempts
    if (anonymousSignInAttempted.current) return
    anonymousSignInAttempted.current = true

    try {
      const { data, error } = await supabaseClient.auth.signInAnonymously()
      if (error) {
        console.warn('Anonymous sign-in failed:', error.message)
        setLoading(false)
        return
      }
      if (data?.user) {
        useAuthStore.getState().setSession(data.user, true)
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.warn('Anonymous sign-in error:', err)
      setLoading(false)
    }
  }, [setLoading])

  // Handle auth state changes
  useEffect(() => {
    // Check navigator.onLine directly (window check is redundant but harmless)
    if (!navigator.onLine) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      // Callback runs on client, navigator.onLine check is sufficient
      if (!navigator.onLine) {
        setLoading(false)
        return
      }

      if (event === 'INITIAL_SESSION') {
        if (!session?.user) {
          // No session - sign in anonymously for document view tracking
          signInAnonymously()
          return
        }
      }
      if (/*event === 'SIGNED_IN' ||*/ event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (!session?.user) {
          // User is not logged in
          setLoading(false)
          return
        }
        // Track if user is anonymous (from Supabase Anonymous Auth)
        const isAnonymous = session?.user?.is_anonymous || false
        useAuthStore.getState().setSession(session?.user || null, isAnonymous)

        // Only fetch profile for non-anonymous users (anonymous users don't have profiles)
        if (session?.user && !isAnonymous) {
          getUserProfile(session?.user)
        } else {
          setLoading(false)
        }
      }
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().setSession(null, false)
        useAuthStore.getState().setProfile(null)
        setLoading(false)
        // Reset flag so anonymous sign-in can happen again
        anonymousSignInAttempted.current = false
      }
    })

    // Unsubscribe when going offline
    const handleOffline = () => {
      data.subscription.unsubscribe()
    }

    window.addEventListener('offline', handleOffline)

    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener('offline', handleOffline)
    }
  }, [signInAnonymously, getUserProfile, setLoading])
}
