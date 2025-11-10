import { useEffect, useCallback, useState } from 'react'
import { useAuthStore } from '@stores'
import { getUserById } from '@api'
import { useApi } from '@hooks/useApi'
import { createClient } from '@utils/supabase/component'

export const useOnAuthStateChange = () => {
  const supabaseClient = createClient()
  const setLoading = useAuthStore((state) => state.setLoading)
  const { request: getUserByIdRequest } = useApi(getUserById, null, false)

  const getUserProfile = useCallback(async (user: any) => {
    const { data, error } = (await getUserByIdRequest(user.id)) as any
    if (error) throw error
    useAuthStore.getState().setProfile({ ...data, status: 'ONLINE' })
    setLoading(false)
  }, [])

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
        // if (!session?.user) router.push('/login')
      }
      if (/*event === 'SIGNED_IN' ||*/ event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (!session?.user) {
          // when user does not login!
          setLoading(false)
          return
        }
        useAuthStore.getState().setSession(session?.user || null)
        if (session?.user) getUserProfile(session?.user)
      }
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().setSession(null)
        useAuthStore.getState().setProfile(null)
        setLoading(false)
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
  }, [supabaseClient])
}
