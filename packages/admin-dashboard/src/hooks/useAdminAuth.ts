import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { logError } from '@/utils/logger'

interface AdminAuthState {
  user: User | null
  loading: boolean
  isAdmin: boolean
}

export function useAdminAuth(): AdminAuthState {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Track if initial auth check is done to prevent re-running
  const authCheckedRef = useRef(false)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  // Stable navigation function using ref
  const navigateTo = useCallback((path: string) => {
    router.replace(path)
  }, [])

  useEffect(() => {
    // Wait for router to be ready (prevents SSG/SSR issues)
    if (!router.isReady) return

    // Skip auth check on login page
    if (router.pathname === '/login' || router.pathname === '/unauthorized') {
      setLoading(false)
      return
    }

    // Only run auth check once per mount
    if (authCheckedRef.current) return
    authCheckedRef.current = true

    async function checkAuth() {
      try {
        const {
          data: { user: authUser }
        } = await supabase.auth.getUser()

        if (!authUser) {
          navigateTo('/login')
          return
        }

        // Check if user exists in admin_users table
        const { data: adminData, error } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', authUser.id)
          .maybeSingle()

        if (error) {
          logError('Failed to check admin status:', error)
          navigateTo('/unauthorized')
          return
        }

        const isAdminUser = !!adminData

        if (!isAdminUser) {
          navigateTo('/unauthorized')
          return
        }

        setUser(authUser)
        setIsAdmin(true)
      } catch (error) {
        logError('Auth check failed:', error)
        navigateTo('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Listen for auth state changes (only subscribe once)
    if (!subscriptionRef.current) {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsAdmin(false)
          authCheckedRef.current = false // Reset so next login triggers check
          navigateTo('/login')
        } else if (event === 'SIGNED_IN' && session?.user) {
          // Check if user is in admin_users table
          const { data: adminData } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', session.user.id)
            .maybeSingle()

          const isAdminUser = !!adminData

          if (isAdminUser) {
            setUser(session.user)
            setIsAdmin(true)
            navigateTo('/')
          } else {
            navigateTo('/unauthorized')
          }
        }
      })
      subscriptionRef.current = subscription
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
    }
  }, [router.isReady, router.pathname, navigateTo])

  return { user, loading, isAdmin }
}
