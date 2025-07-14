import Script from 'next/script'
import { createClient } from '@utils/supabase/component'
import { CredentialResponse } from 'google-one-tap'
import { useRouter } from 'next/router'
import { useEffect, useCallback, useRef } from 'react'

const OneTapComponent = () => {
  const supabase = createClient()
  const router = useRouter()
  const initializationRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleCredentialResponse = useCallback(
    async (response: CredentialResponse) => {
      try {
        if (!response?.credential) {
          console.error('Invalid credential response')
          return
        }

        const { data, error } = await supabase.auth
          .signInWithIdToken({
            provider: 'google',
            token: response.credential
          })
          .catch((err) => {
            throw new Error(`Authentication failed: ${err.message}`)
          })

        if (error) {
          console.error('Supabase auth error:', error.message)
          throw error
        }

        console.info('Successfully logged in with Google One Tap')
        await router.reload()
      } catch (error) {
        console.error('Error logging in with Google One Tap:', error)
      }
    },
    [supabase.auth, router]
  )

  const initializeGoogleOneTap = useCallback(async () => {
    // Prevent multiple initializations
    if (initializationRef.current) return

    try {
      // Create AbortController for this operation
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Check if component is still mounted
      if (abortController.signal.aborted) return

      // Check session first
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError
      if (session) return

      if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set')
        return
      }

      // Wait for Google script with retry mechanism
      let attempts = 0
      const maxAttempts = 20 // 4 seconds max wait

      while (attempts < maxAttempts) {
        if (abortController.signal.aborted) return

        if (typeof window.google !== 'undefined' && window.google.accounts) {
          break
        }

        attempts++
        if (attempts >= maxAttempts) {
          console.error('Google script failed to load after 4 seconds')
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      // Check if still mounted before initializing
      if (abortController.signal.aborted) return

      // Mark as initialized to prevent multiple calls
      initializationRef.current = true

      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true
      })

      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          console.info('One Tap not displayed:', notification.getNotDisplayedReason())
        } else if (notification.isSkippedMoment()) {
          console.info('One Tap skipped:', notification.getSkippedReason())
        }
      })
    } catch (error) {
      console.error('Error initializing Google One Tap:', error)
      initializationRef.current = false // Reset on error
    }
  }, [supabase.auth, handleCredentialResponse])

  useEffect(() => {
    return () => {
      // Abort any ongoing operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      // Cancel Google One Tap
      if (typeof window.google !== 'undefined') {
        window.google.accounts.id.cancel()
      }

      // Reset initialization flag
      initializationRef.current = false
    }
  }, [])

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          // Initialize when script loads
          initializeGoogleOneTap()
        }}
        onError={(e) => {
          console.error('Failed to load Google One Tap script:', e)
          // Reset initialization flag so we can try again if needed
          initializationRef.current = false
        }}
      />
      <div id="oneTap" className="fixed top-0 right-0 z-[100]" />
    </>
  )
}

export default OneTapComponent
