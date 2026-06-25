import { useAuthStore } from '@stores'
import { supabaseClient } from '@utils/supabase'

let anonymousSignInPromise: Promise<void> | null = null

/** Clears in-flight anon sign-in so a fresh attempt can run after sign-out. */
export function resetAnonymousSessionGate(): void {
  anonymousSignInPromise = null
}

/** Lazy anonymous session; landing defers until first document navigation. */
export async function ensureAnonymousSession(): Promise<void> {
  const { data: sessionData } = await supabaseClient.auth.getSession()
  if (sessionData.session?.user) return

  if (!anonymousSignInPromise) {
    anonymousSignInPromise = (async () => {
      try {
        const { data, error } = await supabaseClient.auth.signInAnonymously()
        if (error) {
          console.warn('Anonymous sign-in failed:', error.message)
          return
        }
        if (data?.user) {
          useAuthStore.getState().setSession(data.user, true)
        }
      } catch (err) {
        console.warn('Anonymous sign-in error:', err)
      } finally {
        anonymousSignInPromise = null
      }
    })()
  }

  await anonymousSignInPromise
}
