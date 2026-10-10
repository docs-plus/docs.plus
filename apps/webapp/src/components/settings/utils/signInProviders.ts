import type { User } from '@supabase/supabase-js'

/** Fixed order; a provider not listed here is not shown. */
const SIGN_IN_PROVIDERS = ['google', 'email'] as const

export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number]

/** The listed sign-in methods this user holds. Security and its loader both read it. */
export const signInProvidersOf = (user: User | null | undefined): SignInProvider[] => {
  if (!user) return []
  const fromIdentities = user.identities?.map((identity) => identity.provider) ?? []
  const held = new Set<string>(
    fromIdentities.length ? fromIdentities : (user.app_metadata?.providers ?? [])
  )
  return SIGN_IN_PROVIDERS.filter((provider) => held.has(provider))
}
