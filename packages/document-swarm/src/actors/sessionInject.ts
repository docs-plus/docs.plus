import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import type { BrowserContext } from 'playwright'

import type { ActorRecord } from '../types.ts'
import { requireEnv } from './env.ts'
import { createChunks, encodeSessionCookieValue } from './ssrCookieChunks.ts'

const COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60

// supabase-js default: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
// (e.g. local `sb-localhost-auth-token`, cloud `sb-<project-ref>-auth-token`).
function authStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
}

// Captures the exact string auth-js persists (`JSON.stringify(session)`), so the injected
// cookie matches whatever session shape the SDK writes rather than a hand-built guess.
function createCaptureStorage(store: Record<string, string>): SupportedStorage {
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value
    },
    removeItem: (key) => {
      delete store[key]
    }
  }
}

async function signInActor(
  actor: ActorRecord,
  supabaseUrl: string,
  anonKey: string,
  storageKey: string
): Promise<string> {
  const store: Record<string, string> = {}
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      storageKey,
      storage: createCaptureStorage(store),
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  const { error } = await client.auth.signInWithPassword({
    email: actor.email,
    password: actor.password
  })
  if (error) throw new Error(`Failed to sign in Swarm Actor ${actor.email}: ${error.message}`)

  const sessionJson = store[storageKey]
  if (!sessionJson) {
    throw new Error(`Swarm Actor ${actor.email} signed in but no session was persisted to storage.`)
  }
  return sessionJson
}

/**
 * Signs the actor in server-side and injects the resulting Supabase session into the
 * browser context as the cookies @supabase/ssr expects on the target origin, so the
 * webapp's browser client loads authenticated as that Swarm Actor.
 */
export async function applyActorSession(
  context: BrowserContext,
  actor: ActorRecord,
  targetUrl: string
): Promise<void> {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const storageKey = authStorageKey(supabaseUrl)

  const sessionJson = await signInActor(actor, supabaseUrl, anonKey, storageKey)
  const cookieValue = encodeSessionCookieValue(sessionJson)

  const origin = new URL(targetUrl)
  const expires = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_S
  await context.addCookies(
    createChunks(storageKey, cookieValue).map(({ name, value }) => ({
      name,
      value,
      domain: origin.hostname,
      path: '/',
      httpOnly: false,
      secure: origin.protocol === 'https:',
      sameSite: 'Lax' as const,
      expires
    }))
  )
}
