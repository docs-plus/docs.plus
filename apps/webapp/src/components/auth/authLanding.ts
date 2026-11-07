import * as toast from '@components/toast'
import { captureUnknown } from '@utils/observability'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { supabaseClient } from '@utils/supabase'

import {
  describeCodeExchangeError,
  describeReturnErrorCode,
  describeTokenHashError
} from './signInErrors'

const ERROR_PARAMS = ['error', 'error_code', 'error_description']
let codeChecked = false

const replaceUrl = (url: URL) =>
  window.history.replaceState(window.history.state, '', url.toString())

const capture = (error: unknown) => captureUnknown(error, { tags: { surface: 'auth-landing' } })

/** One answer for every failed return. A reader already signed in gets a quiet note. */
async function explainFailedReturn(message: string): Promise<void> {
  const { data } = await supabaseClient.auth.getSession()
  if (data.session) {
    toast.Info("You're already signed in.")
    return
  }
  // It outlives the 5 s default, so a reader can follow the reason.
  toast.Error(message, {
    duration: 12_000,
    actionLabel: 'Sign in',
    onAction: () => openInlineSignInDialog()
  })
}

// The mail links back with `#token_hash=` (`packages/supabase/templates`). `verifyOtp`
// needs no PKCE verifier, so it works in any browser. Only this call spends the token.
async function signInWithTokenHash(tokenHash: string): Promise<void> {
  const { error } = await supabaseClient.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  // A full load, as OAuth gives, so server props and deep-link params run signed in.
  if (!error) return window.location.reload()
  await explainFailedReturn(describeTokenHashError(error))
}

// supabase-js exchanges `?code=` itself, but strips it only on success and swallows the
// failure. `initialize()` is idempotent and resolves `{ error }`, so read the answer there.
async function explainFailedCodeExchange(): Promise<void> {
  const { error } = await supabaseClient.auth.initialize()
  if (!error) return
  capture(error)
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  replaceUrl(url)
  await explainFailedReturn(describeCodeExchangeError(error))
}

/**
 * Finishes or explains a return from sign-in: an email link's `#token_hash`, a PKCE
 * `?code=`, or Auth's `?error_code=`. `proxy.ts` never runs on Next 15, so this is the
 * only place that reads them. Each one-shot param leaves the URL before any await.
 */
export function handleAuthLanding(): void {
  const url = new URL(window.location.href)

  const tokenHash = new URLSearchParams(url.hash.slice(1)).get('token_hash')
  if (tokenHash) {
    url.hash = ''
    replaceUrl(url)
    signInWithTokenHash(tokenHash).catch(capture)
  }

  const errorCode = url.searchParams.get('error_code')
  // /auth/error explains the same code on its own card.
  if (errorCode && url.pathname !== '/auth/error') {
    ERROR_PARAMS.forEach((key) => url.searchParams.delete(key))
    replaceUrl(url)
    explainFailedReturn(describeReturnErrorCode(errorCode)).catch(capture)
  }

  if (!codeChecked && url.searchParams.has('code')) {
    codeChecked = true
    explainFailedCodeExchange().catch(capture)
  }
}
