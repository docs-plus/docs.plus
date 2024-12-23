import { useEffect, useCallback } from 'react'
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
    // set display name, we have to read diplay name from auth store
    const displayName =
      data?.display_name ||
      data?.username ||
      data?.email.split('@')[0] ||
      user?.email?.split('@')[0]

    useAuthStore.getState().setDisplayName(displayName)
    useAuthStore.getState().setProfile({ ...data, status: 'ONLINE' })
    setLoading(false)
  }, [])

  // Handle auth state changes
  useEffect(() => {
    setLoading(true)
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        // if (!session?.user) router.push('/login')
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (!session?.user) {
          // when user does not login!
          setLoading(false)
          return
        }
        useAuthStore.getState().setSession(session?.user || null)
        if (session?.user) getUserProfile(session?.user)
        setLoading(false)
      }
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().setSession(null)
        useAuthStore.getState().setProfile(null)
        // router.push('/login')
        setLoading(false)
      }
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [supabaseClient])
}
