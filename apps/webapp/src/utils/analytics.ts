import type { Session } from '@supabase/supabase-js'

type GtagParams = Record<string, string | number | boolean | undefined>

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void }

/** No-op when gtag is absent (dev, ad blockers, analytics-disabled routes). */
export const trackEvent = (name: string, params?: GtagParams): void => {
  if (typeof window === 'undefined') return
  const { gtag } = window as GtagWindow
  if (typeof gtag !== 'function') return
  gtag('event', name, params)
}

const SIGN_UP_TRACKED_KEY = 'docsplus.signUpTrackedUserId'

/**
 * SIGNED_IN also fires on returning logins and tab refocus; a fresh created_at
 * marks a real sign-up. The guard persists in localStorage because the 5-minute
 * window spans several page loads (OAuth redirects, post-signup navigation).
 */
export const trackSignUpOnce = (session: Session | null): void => {
  const user = session?.user
  if (!user || user.is_anonymous) return
  const createdAt = Date.parse(user.created_at ?? '')
  if (!Number.isFinite(createdAt) || Date.now() - createdAt >= 5 * 60_000) return
  try {
    if (localStorage.getItem(SIGN_UP_TRACKED_KEY) === user.id) return
    localStorage.setItem(SIGN_UP_TRACKED_KEY, user.id)
  } catch {
    // No storage (private mode) — skip rather than refire on every load.
    return
  }
  trackEvent('sign_up', { method: user.app_metadata?.provider ?? 'email' })
}
