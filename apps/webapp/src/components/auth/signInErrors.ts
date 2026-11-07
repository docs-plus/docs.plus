import {
  isAuthError,
  isAuthPKCECodeVerifierMissingError,
  isAuthRetryableFetchError
} from '@supabase/supabase-js'

export interface SignInProblem {
  message: string
  /** Set only when Supabase named the wait, so the form can count it down. */
  retryInSeconds?: number
}

const OFFLINE = "We couldn't reach docs.plus. Check your connection and try again."
const RETRY_AFTER = /after (\d+) seconds?/i

/** Supabase writes the wait only into the 429 text, so this is the one message read. */
const parseRetryAfter = (message: string): number | undefined => {
  const match = RETRY_AFTER.exec(message)
  // Auth rounds down, so the last second of the window reads "after 0 seconds".
  return match ? Math.max(1, Number(match[1])) : undefined
}

/** Why `signInWithOtp` failed, in words a person can act on. Keyed on the code, never the text. */
export function describeEmailLinkError(error: unknown): SignInProblem {
  if (isAuthRetryableFetchError(error) || !isAuthError(error)) return { message: OFFLINE }

  switch (error.code) {
    case 'over_email_send_rate_limit': {
      const retryInSeconds = parseRetryAfter(error.message)
      return retryInSeconds
        ? {
            message:
              'We just sent a link to this email. Use the newest email, or ask again when the timer ends.',
            retryInSeconds
          }
        : { message: 'Too many sign-in emails were sent. Wait a few minutes, or use Google.' }
    }
    case 'over_request_rate_limit':
      return { message: 'Too many tries from this network. Wait a few minutes, or use Google.' }
    case 'email_address_invalid':
      // Supabase refuses example and test domains with this code.
      return { message: 'Use a real email address. Test and example addresses get no mail.' }
    case 'validation_failed':
      return { message: 'Enter a valid email.' }
    case 'email_address_not_authorized':
      return { message: "We can't send email to this address. Continue with Google instead." }
    case 'signup_disabled':
    case 'email_provider_disabled':
    case 'otp_disabled':
      return { message: 'Email sign-in is off right now. Continue with Google instead.' }
    default:
      return { message: "We couldn't send the link. Try again, or continue with Google." }
  }
}

/** Why a returning sign-in link (`?code=`) did not sign this browser in. */
export function describeLinkLandingError(error: unknown): string {
  // The verifier is missing in another browser, and also after an older email's link
  // spent it here (each request replaces it; measured with @supabase/ssr 0.12.7).
  if (isAuthPKCECodeVerifierMissingError(error)) {
    return "This older sign-in link can't sign you in here. Sign in again: the new link works in any browser."
  }
  // A newer request replaced this browser's verifier, so an older email's code no longer matches.
  if (
    isAuthError(error) &&
    (error.code === 'validation_failed' || error.code === 'bad_code_verifier')
  ) {
    return 'This link is from an older email. Sign in again: the new link works in any browser.'
  }
  if (isAuthRetryableFetchError(error)) {
    return "Sign-in didn't finish because docs.plus could not be reached. Check your connection and sign in again."
  }
  return 'This sign-in link has expired or was already used. Sign in again to get a new link.'
}

/** Why Supabase sent the reader back with `?error_code=` instead of a session. */
export function describeLinkErrorCode(code: string): string {
  return code === 'otp_expired'
    ? 'This sign-in link no longer works. A link works once, for 1 hour. Sign in again to get a new one.'
    : "Sign-in didn't finish. Sign in again to get a new link."
}
