import Script from 'next/script'
import { createClient } from '@utils/supabase/component'
import { CredentialResponse } from 'google-one-tap'
import { useRouter } from 'next/router'
import { useEffect, useCallback } from 'react'

const OneTapComponent = () => {
  const supabase = createClient()
  const router = useRouter()

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

  useEffect(() => {
    const initializeGoogleOneTap = async () => {
      try {
        // Check session first
        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError
        if (session) return

        if (typeof window.google === 'undefined') {
          console.error('Google script not loaded')
          return
        }

        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          callback: handleCredentialResponse,
          auto_select: false, // Don't auto select the account
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
      }
    }

    // Small delay to ensure the script is loaded
    const timeoutId = setTimeout(initializeGoogleOneTap, 1000)

    return () => {
      clearTimeout(timeoutId)
      // Cleanup
      if (typeof window.google !== 'undefined') {
        window.google.accounts.id.cancel()
      }
    }
  }, [handleCredentialResponse, router, supabase.auth])

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => console.info('Google script loaded')}
        onError={(e) => console.error('Error loading Google script:', e)}
      />
      <div id="oneTap" className="fixed right-0 top-0 z-[100]" />
    </>
  )
}

export default OneTapComponent
