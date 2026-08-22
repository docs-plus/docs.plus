import {
  announceSignedInProfile,
  applySignedInProfile
} from '@components/auth/applySignedInProfile'
import * as toast from '@components/toast'
import { supabaseClient } from '@utils/supabase'
// Type-only import backed by @types/google-one-tap (the runtime ships no types).
// One Tap runtime is Google's GSI script loaded via next/script below — not the
// google-one-tap npm package, which clobbers window.onload and dies on SPA nav.
import type { CredentialResponse, PromptMomentNotification } from 'google-one-tap'
import Script from 'next/script'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Generates a cryptographic nonce for Google ID token sign-in.
 * Returns both the raw nonce (for Supabase) and hashed nonce (for Google).
 */
const generateNonce = async (): Promise<[string, string]> => {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(nonce))
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return [nonce, hashedNonce]
}

const GOOGLE_SCRIPT_LOAD_TIMEOUT_MS = 4000
const POLL_INTERVAL_MS = 200

const GoogleOneTapAuth = () => {
  const supabase = supabaseClient
  const isInitialized = useRef(false)
  const nonceRef = useRef<string | null>(null)

  const handleCredentialResponse = useCallback(
    async (response: CredentialResponse) => {
      try {
        if (!response?.credential || !nonceRef.current) {
          console.error('Google One Tap: Invalid credential or nonce')
          return
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
          nonce: nonceRef.current
        })

        if (error) throw error
        if (!data.user) return

        // Acknowledge before the profile round trip — the sign-in already earned
        // the feedback, and gating it on a fetch just adds dead air.
        toast.Success('Signed in')

        announceSignedInProfile(await applySignedInProfile(data.user))
      } catch (error) {
        console.error('Google One Tap login failed:', error)
      }
    },
    [supabase.auth]
  )

  const initializeGoogleOneTap = useCallback(async () => {
    if (isInitialized.current) return

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (session) return

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      if (!clientId) {
        console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set')
        return
      }

      const maxAttempts = GOOGLE_SCRIPT_LOAD_TIMEOUT_MS / POLL_INTERVAL_MS
      for (let i = 0; i < maxAttempts; i++) {
        if (window.google?.accounts) break
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }

      if (!window.google?.accounts) {
        console.error('Google One Tap script failed to load within timeout')
        return
      }

      const [nonce, hashedNonce] = await generateNonce()
      nonceRef.current = nonce
      isInitialized.current = true

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        nonce: hashedNonce,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true
      })

      window.google.accounts.id.prompt((notification: PromptMomentNotification) => {
        if (notification.isNotDisplayed()) {
          console.info('Google One Tap not displayed:', notification.getNotDisplayedReason())
        } else if (notification.isSkippedMoment()) {
          console.info('Google One Tap skipped:', notification.getSkippedReason())
        }
      })
    } catch (error) {
      console.error('Google One Tap initialization failed:', error)
      isInitialized.current = false
    }
  }, [supabase.auth, handleCredentialResponse])

  useEffect(() => {
    return () => {
      window.google?.accounts?.id?.cancel()
      isInitialized.current = false
    }
  }, [])

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={initializeGoogleOneTap}
      onError={() => {
        console.error('Failed to load Google One Tap script')
        isInitialized.current = false
      }}
    />
  )
}

export default GoogleOneTapAuth
