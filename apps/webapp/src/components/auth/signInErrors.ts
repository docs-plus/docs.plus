import {
  isAuthError,
  isAuthPKCECodeVerifierMissingError,
  isAuthRetryableFetchError
} from '@supabase/supabase-js'

/** Mirrors the dashboard's Email OTP expiration (3600 s) and the templates' sentence. */
export const LINK_LIFETIME = '1 hour'

export interface SignInProblem {
  message: string
  /** Set only when Supabase named the wait, so the form can count it down. */
  retryInSeconds?: number
}

const OFFLINE = "We couldn't reach docs.plus. Check your connection and try again."
const SPENT_LINK = `This sign-in link no longer works. A link works once, for ${LINK_LIFETIME}. Sign in again to get a new one.`
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

/** Why the email link's `#token_hash` did not sign in. Only this path may name the email. */
export function describeTokenHashError(error: unknown): string {
  if (isAuthRetryableFetchError(error) || !isAuthError(error)) return OFFLINE
  return error.code === 'otp_expired'
    ? SPENT_LINK
    : "This sign-in link didn't work. Sign in again to get a new one."
}

/** Why a `?code=` return did not sign in. Google uses this path too, so it names neither. */
export function describeCodeExchangeError(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return "Sign-in didn't finish because docs.plus could not be reached. Check your connection and sign in again."
  }
  // The verifier lives in the browser that started sign-in.
  return isAuthPKCECodeVerifierMissingError(error)
    ? "Sign-in didn't finish in this browser. Sign in again here."
    : "Sign-in didn't finish. Sign in again."
}

/** Why Auth sent the reader back with `?error_code=`. Only `otp_expired` is email-only. */
export function describeReturnErrorCode(code: string): string {
  return code === 'otp_expired' ? SPENT_LINK : "Sign-in didn't finish. Sign in again."
}
