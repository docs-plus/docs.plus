import type { User } from '@supabase/supabase-js'
import Router, { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

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

  // Run the per-route admin check only once per mount.
  const authCheckedRef = useRef(false)

  // Per-route gate: verify the session and admin_users membership once the
  // router is ready (skips the public login/unauthorized pages).
  useEffect(() => {
    if (!router.isReady) return

    if (router.pathname === '/login' || router.pathname === '/unauthorized') {
      setLoading(false)
      return
    }

    if (authCheckedRef.current) return
    authCheckedRef.current = true

    async function checkAuth() {
      try {
        const {
          data: { user: authUser }
        } = await supabase.auth.getUser()

        if (!authUser) {
          Router.replace('/login')
          return
        }

        // Direct admin_users reads are revoked for authenticated (lint
        // hardening); is_admin is the whitelisted SECURITY DEFINER gate.
        const { data: isAdminResult, error } = await supabase.rpc('is_admin', {
          check_user_id: authUser.id
        })

        if (error) {
          logError('Failed to check admin status:', error)
          Router.replace('/unauthorized')
          return
        }

        if (!isAdminResult) {
          Router.replace('/unauthorized')
          return
        }

        setUser(authUser)
        setIsAdmin(true)
      } catch (error) {
        logError('Auth check failed:', error)
        Router.replace('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router.isReady, router.pathname])

  // Auth-state listener lives in its own subscribe-once effect (navigation goes
  // through the Router singleton so route changes never tear it down).
  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsAdmin(false)
        authCheckedRef.current = false // re-run the check on next sign-in
        Router.replace('/login')
      } else if (event === 'SIGNED_IN' && session?.user) {
        const { data: isAdminResult } = await supabase.rpc('is_admin', {
          check_user_id: session.user.id
        })

        if (isAdminResult) {
          setUser(session.user)
          setIsAdmin(true)
          // SIGNED_IN also fires on session re-establishment (tab refocus);
          // only an actual login should leave the current page.
          if (Router.pathname === '/login') Router.replace('/')
        } else {
          Router.replace('/unauthorized')
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isAdmin }
}
