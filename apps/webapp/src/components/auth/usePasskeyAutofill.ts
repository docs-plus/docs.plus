import {
  browserSupportsPasskeyAutofill,
  toAuthenticationResponse,
  toCredentialRequestOptions
} from '@utils/passkey'
import { supabaseClient } from '@utils/supabase'
import { useEffect, useRef } from 'react'

type VerifyCredential = Parameters<
  typeof supabaseClient.auth.passkey.verifyAuthentication
>[0]['credential']

/** Conditional-mediation autofill. `signInWithPasskey` has no `mediation` option. */
export function usePasskeyAutofill(onSignedIn: () => void): void {
  const onSignedInRef = useRef(onSignedIn)
  onSignedInRef.current = onSignedIn

  useEffect(() => {
    const controller = new AbortController()
    let unmounted = false

    const run = async () => {
      if (!(await browserSupportsPasskeyAutofill()) || controller.signal.aborted) return

      const { data, error } = await supabaseClient.auth.passkey.startAuthentication()
      if (error || !data || controller.signal.aborted) return

      let credential: Credential | null = null
      try {
        credential = await navigator.credentials.get({
          publicKey: toCredentialRequestOptions(data.options as unknown as Record<string, unknown>),
          mediation: 'conditional',
          signal: controller.signal
        } as CredentialRequestOptions)
      } catch {
        return
      }
      if (!credential || controller.signal.aborted) return

      const { error: verifyError } = await supabaseClient.auth.passkey.verifyAuthentication({
        challengeId: data.challenge_id,
        credential: toAuthenticationResponse(credential as PublicKeyCredential) as VerifyCredential
      })
      if (!verifyError && !unmounted) onSignedInRef.current()
    }

    void run()

    return () => {
      unmounted = true
      controller.abort()
    }
  }, [])
}
