export type PasskeyOutcome =
  { status: 'ok' } | { status: 'cancelled' } | { status: 'error'; message: string }

// Two vocabularies reach here. Auth answers server failures with snake_case codes.
// The browser ceremony fails as a WebAuthnError with SCREAMING_SNAKE codes.
const PASSKEY_ERROR_COPY: Record<string, string> = {
  passkey_disabled: 'Passkeys are turned off for this site.',
  too_many_passkeys: 'This account already holds the most passkeys we allow.',
  webauthn_credential_exists: 'This device already has a passkey here.',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'This device already has a passkey here.',
  webauthn_credential_not_found: 'No passkey on this device matches an account here.',
  webauthn_challenge_not_found: 'The request expired. Try again.',
  webauthn_challenge_expired: 'The request expired. Try again.',
  webauthn_verification_failed: 'The device could not be verified. Try again.',
  ERROR_INVALID_RP_ID: 'This site is not set up for passkeys yet.',
  ERROR_INVALID_DOMAIN: 'This site is not set up for passkeys yet.',
  email_not_confirmed: 'Confirm your email address first.'
}

const errorCode = (error: unknown) => (error as { code?: string } | null)?.code
const errorName = (error: unknown) => (error as { name?: string } | null)?.name

/** A dismissed platform prompt arrives as a rejection, so it must never read as a failure. */
function isCancelled(error: unknown): boolean {
  const name = errorName(error)
  return (
    name === 'NotAllowedError' ||
    name === 'AbortError' ||
    errorCode(error) === 'ERROR_CEREMONY_ABORTED'
  )
}

export function isPasskeyDisabled(error: unknown): boolean {
  return errorCode(error) === 'passkey_disabled'
}

export function toPasskeyOutcome(error: unknown, fallback: string): PasskeyOutcome {
  if (isCancelled(error)) return { status: 'cancelled' }
  const code = errorCode(error)
  return { status: 'error', message: (code && PASSKEY_ERROR_COPY[code]) || fallback }
}

/** WebAuthn is absent on old browsers and in some in-app webviews; hide the control there. */
export function browserSupportsPasskeys(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function'
}

/** Autofill needs conditional mediation, which Safari 16 and older Chrome lack. */
export async function browserSupportsPasskeyAutofill(): Promise<boolean> {
  if (!browserSupportsPasskeys()) return false
  const api = window.PublicKeyCredential as typeof PublicKeyCredential & {
    isConditionalMediationAvailable?: () => Promise<boolean>
  }
  if (typeof api.isConditionalMediationAvailable !== 'function') return false
  try {
    return await api.isConditionalMediationAvailable()
  } catch {
    return false
  }
}

const fromBase64Url = (value: string): ArrayBuffer => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

const toBase64Url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Auth does not export these converters. Prefer the native WebAuthn JSON bridge. */
export function toCredentialRequestOptions(
  serverOptions: Record<string, unknown>
): PublicKeyCredentialRequestOptions {
  const api = window.PublicKeyCredential as typeof PublicKeyCredential & {
    parseRequestOptionsFromJSON?: (o: unknown) => PublicKeyCredentialRequestOptions
  }
  if (typeof api.parseRequestOptionsFromJSON === 'function') {
    return api.parseRequestOptionsFromJSON(serverOptions)
  }

  const { challenge, allowCredentials, ...rest } = serverOptions as {
    challenge: string
    allowCredentials?: { id: string; transports?: string[] }[]
  }
  return {
    ...rest,
    challenge: fromBase64Url(challenge),
    ...(allowCredentials?.length
      ? {
          allowCredentials: allowCredentials.map((credential) => ({
            ...credential,
            id: fromBase64Url(credential.id),
            type: 'public-key' as const
          }))
        }
      : {})
  } as PublicKeyCredentialRequestOptions
}

export function toAuthenticationResponse(
  credential: PublicKeyCredential
): AuthenticationResponseJSON {
  if (typeof credential.toJSON === 'function') {
    return credential.toJSON() as AuthenticationResponseJSON
  }

  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : undefined
    }
  } as AuthenticationResponseJSON
}
