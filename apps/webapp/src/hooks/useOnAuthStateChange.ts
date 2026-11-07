import { applySignedInProfile } from '@components/auth/applySignedInProfile'
import { openInlineSignInDialog } from '@components/auth/openInlineSignInDialog'
import { describeLinkErrorCode, describeLinkLandingError } from '@components/auth/signInErrors'
import * as toast from '@components/toast'
import { useAuthStore } from '@stores'
import { isAuthApiError, type User } from '@supabase/supabase-js'
import { trackSignUpOnce } from '@utils/analytics'
import { writeAppBadge } from '@utils/appBadge'
import { captureUnknown, setObservabilityUser } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'
import { useCallback, useEffect } from 'react'

import { clearMediaSession, postMediaSession, retryMediaAfterSession } from './mediaSession'

/** One explanation for a failed email link, with a way to start over. It outlives the 5 s default. */
const reportFailedLink = (message: string) =>
  toast.Error(message, {
    duration: 12_000,
    actionLabel: 'Sign in',
    onAction: () => openInlineSignInDialog()
  })

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
    reportFailedLink(describeLinkLandingError(error))
  })
}

const AUTH_ERROR_PARAMS = ['error', 'error_code', 'error_description']

// Supabase sends a spent or failed link back as `?error_code=`. `proxy.ts` is meant to
// route that to /auth/error, but Next 15 never loads it. Explain it here and strip the params.
const reportAuthLinkError = () => {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('error_code')
  // /auth/error explains the same code on its own card.
  if (!code || url.pathname === '/auth/error') return
  AUTH_ERROR_PARAMS.forEach((key) => url.searchParams.delete(key))
  window.history.replaceState(window.history.state, '', url.toString())
  supabaseClient.auth.getSession().then(({ data }) => {
    // A spent link often opens after a newer one already signed this browser in.
    if (data.session) {
      toast.Info("You're already signed in. That email link was used before.")
      return
    }
    reportFailedLink(describeLinkErrorCode(code))
  })
}

let lastLinkHash: string | null = null

// The sign-in mail links back with `#token_hash=` (`packages/supabase/templates`).
// `verifyOtp` needs no PKCE verifier, so the link works in any browser or mail app.
// A fragment never reaches a server log, and only this call spends the token.
const signInFromLinkHash = () => {
  const tokenHash = new URLSearchParams(window.location.hash.slice(1)).get('token_hash')
  if (!tokenHash || tokenHash === lastLinkHash) return
  lastLinkHash = tokenHash
  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(window.history.state, '', url.toString())

  supabaseClient.auth
    .verifyOtp({ token_hash: tokenHash, type: 'email' })
    .then(async ({ error }) => {
      if (!error) {
        // A full load, as OAuth gives, so server props, the Private gate and
        // deep-link params all run signed in.
        window.location.reload()
        return
      }
      const { data } = await supabaseClient.auth.getSession()
      if (data.session) {
        toast.Info("You're already signed in. That email link was used before.")
        return
      }
      reportFailedLink(
        isAuthApiError(error) && error.code === 'otp_expired'
          ? describeLinkErrorCode('otp_expired')
          : describeLinkLandingError(error)
      )
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
    signInFromLinkHash()
    // A link pasted into a tab already on its page changes only the hash.
    window.addEventListener('hashchange', signInFromLinkHash)
    reportPkceExchangeFailure()
    reportAuthLinkError()
    const stopMediaRetry = retryMediaAfterSession()
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (!navigator.onLine) {
        setLoading(false)
        return
      }

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
      window.removeEventListener('hashchange', signInFromLinkHash)
    }
  }, [getUserProfile, setLoading])
}
