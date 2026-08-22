import { supabaseClient } from '@utils/supabase'

import { applySignedInProfile, type SignedInProfileOutcome } from './applySignedInProfile'

const POPUP_WIDTH = 500
const POPUP_HEIGHT = 640
/** Google's consent screen plus a slow network. Past this the popup is presumed abandoned. */
const POPUP_TIMEOUT_MS = 180_000
const POPUP_CLOSED_POLL_MS = 500

/**
 * Must run inside the click handler, before any `await`. A popup opened after one
 * is programmatic to the browser, and blocked. Mobile browsers usually give a new
 * tab instead of a window, so `null` here means "fall back to a full redirect".
 */
export function openGoogleAuthPopup(): Window | null {
  if (typeof window === 'undefined') return null

  const left = window.screenX + Math.max(0, (window.outerWidth - POPUP_WIDTH) / 2)
  const top = window.screenY + Math.max(0, (window.outerHeight - POPUP_HEIGHT) / 2)
  const features = `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`

  try {
    const popup = window.open('', 'docsplus-google-signin', features)
    return popup && !popup.closed ? popup : null
  } catch {
    return null
  }
}

/**
 * The popup writes the session to cookies this tab shares, and auth-js relays the
 * event over its BroadcastChannel. Waiting on that beats polling getSession(),
 * which can answer from a stale in-memory copy.
 */
function waitForPopupSignIn(popup: Window): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false

    const finish = (signedIn: boolean) => {
      if (settled) return
      settled = true
      clearInterval(closedTimer)
      clearTimeout(deadline)
      subscription.data.subscription.unsubscribe()
      resolve(signedIn)
    }

    const subscription = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) finish(true)
    })

    // Covers the reader dismissing the window, and any engine that never relays.
    const closedTimer = setInterval(async () => {
      if (!popup.closed) return
      const { data } = await supabaseClient.auth.getSession()
      finish(Boolean(data.session?.user))
    }, POPUP_CLOSED_POLL_MS)

    const deadline = setTimeout(() => finish(false), POPUP_TIMEOUT_MS)
  })
}

export type GooglePopupOutcome = 'dismissed' | SignedInProfileOutcome

/** Popup wait, then call-site hydration. `onAuthStateChange` ignores SIGNED_IN. */
export async function completeGooglePopupSignIn(popup: Window): Promise<GooglePopupOutcome> {
  const signedIn = await waitForPopupSignIn(popup)
  if (!popup.closed) popup.close()
  if (!signedIn) return 'dismissed'

  const { data } = await supabaseClient.auth.getSession()
  const user = data.session?.user
  if (!user) return 'dismissed'

  return applySignedInProfile(user)
}

/**
 * `skipBrowserRedirect: false` lets auth-js navigate this tab, which is the fallback.
 * `login_hint` is what makes a "Continue as <name>" button land on that account
 * instead of the picker. Without it the label promises more than the flow delivers.
 */
export const googleOAuthOptions = (
  redirectTo: string,
  usePopup: boolean,
  loginHint?: string | null
) => ({
  redirectTo,
  skipBrowserRedirect: usePopup,
  queryParams: {
    access_type: 'offline',
    prompt: 'consent',
    ...(loginHint ? { login_hint: loginHint } : {})
  },
  scopes:
    'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
})
