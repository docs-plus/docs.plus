/**
 * The pieces every real-infra E2E script repeats: the two spawned entry points,
 * the REST client, the poll loop, the throwaway Supabase user and the collab
 * client. Four scripts held byte-identical copies of this, differing only in a
 * prefix string, which is why `e2e-document-changes.ts` crossed 1000 lines.
 *
 * Import it from a standalone script, never from `src/`. It spawns processes.
 */
import { TiptapTransformer } from '@hocuspocus/transformer'
import { createClient } from '@supabase/supabase-js'
import * as Y from 'yjs'

const PACKAGE_ROOT = new URL('../..', import.meta.url).pathname
const REPO_ROOT = new URL('../../../..', import.meta.url).pathname

export interface Tally {
  check: (condition: boolean, message: string) => void
  skip: (message: string) => void
  outcome: () => { failed: boolean; skipped: number }
}

/** One counter pair per run. A module-level `let` would leak between imports. */
export const createTally = (): Tally => {
  let failed = false
  let skipped = 0
  return {
    check: (condition, message) => {
      console.log(`  ${condition ? '✓' : '✗'} ${message}`)
      if (!condition) failed = true
    },
    skip: (message) => {
      console.log(`  ⚠ skipped — ${message}`)
      skipped += 1
    },
    outcome: () => ({ failed, skipped })
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const freePort = (): number => {
  const probe = Bun.serve({ port: 0, fetch: () => new Response('') })
  const { port } = probe
  probe.stop(true)
  if (port === undefined) throw new Error('Bun.serve did not assign a port')
  return port
}

export const waitForHttp = async (url: string, timeoutMs = 30_000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      // not up yet
    }
    await sleep(200)
  }
  return false
}

export interface Servers {
  wsPort: number
  internalPort: number
  restPort: number
  restUrl: string
  kill: () => void
}

/**
 * Both entry points on free ports, so parallel runs cannot collide. Log levels
 * are turned down because a passing run's output is the assertion list.
 */
export const spawnServers = (): Servers => {
  const wsPort = freePort()
  const internalPort = freePort()
  const restPort = freePort()

  const env = {
    ...process.env,
    NODE_ENV: 'development',
    LOG_LEVEL: 'warn',
    REST_LOG_LEVEL: 'warn',
    WS_LOG_LEVEL: 'warn',
    HOCUSPOCUS_PORT: String(wsPort),
    HOCUSPOCUS_INTERNAL_HTTP_PORT: String(internalPort),
    HOCUSPOCUS_INTERNAL_HTTP_HOST: '127.0.0.1',
    HOCUSPOCUS_INTERNAL_URL: `http://127.0.0.1:${internalPort}`,
    APP_PORT: String(restPort)
  }

  const spawn = (entry: string) =>
    Bun.spawn(['bun', entry], { cwd: PACKAGE_ROOT, env, stdout: 'inherit', stderr: 'inherit' })

  const ws = spawn('src/hocuspocus.server.ts')
  const rest = spawn('src/index.ts')

  return {
    wsPort,
    internalPort,
    restPort,
    restUrl: `http://127.0.0.1:${restPort}`,
    kill: () => {
      ws.kill()
      rest.kill()
    }
  }
}

export interface RestResponse {
  status: number
  body: any
}

/**
 * `auth` defaults to the service-role key and takes `null` to send no bearer,
 * which is how the auth-gate assertions reach a 401.
 */
export const makeRest =
  (restUrl: string, serviceKey: string) =>
  async (
    path: string,
    init: RequestInit & { auth?: string | null } = {}
  ): Promise<RestResponse> => {
    const { auth = serviceKey, ...requestInit } = init
    const response = await fetch(`${restUrl}${path}`, {
      ...requestInit,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(requestInit.headers ?? {})
      }
    })
    const text = await response.text()
    let body: any
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    return { status: response.status, body }
  }

/** The worker is asynchronous, so every read of a persisted row polls for it. */
export const pollFor = async <T>(
  read: () => Promise<T | null>,
  accept: (value: T) => boolean,
  timeoutMs = 25_000
): Promise<T | null> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await read()
    if (value && accept(value)) return value
    await sleep(200)
  }
  return null
}

export const decodeText = (data: Uint8Array): string => {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, new Uint8Array(data))
  return JSON.stringify(TiptapTransformer.fromYdoc(ydoc, 'default'))
}

export interface TestUser {
  id: string
  email: string
  accessToken: string
}

/**
 * A verifiable identity needs a token the WS process can check, so it needs live
 * Supabase Auth. CI points SUPABASE_URL at a closed port on purpose, so this
 * returns null there and the caller degrades to a skip rather than a false green.
 */
export const mintTestUser = async (
  prefix: string,
  serviceKey: string,
  fullName: string
): Promise<TestUser | null> => {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const email = `${prefix}@docs.plus.test`
  const password = `${prefix}-Passw0rd!`
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })
    if (created.error || !created.data.user) return null

    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const signedIn = await anon.auth.signInWithPassword({ email, password })
    if (signedIn.error || !signedIn.data.session) return null

    return { id: created.data.user.id, email, accessToken: signedIn.data.session.access_token }
  } catch {
    return null
  }
}

export const deleteTestUser = async (user: TestUser | null, serviceKey: string): Promise<void> => {
  const url = process.env.SUPABASE_URL
  if (!user || !url) return
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    await admin.auth.admin.deleteUser(user.id)
  } catch {
    // the run already reported; a leftover throwaway user is not a failure
  }
}

// Resolved against the webapp because @hocuspocus/provider is a webapp
// dependency, not a backend one. Hoisting the provider for a test-only client
// would put a client library in the server's dependency graph.
const providerModule = await import(
  Bun.resolveSync('@hocuspocus/provider', `${REPO_ROOT}apps/webapp`)
)
const { HocuspocusProvider } = providerModule as {
  HocuspocusProvider: new (config: Record<string, unknown>) => any
}

export const makeOpenProvider =
  (wsPort: number) =>
  async (
    documentId: string,
    slug: string,
    accessToken: string
  ): Promise<{ provider: any; ydoc: Y.Doc; synced: boolean }> => {
    const ydoc = new Y.Doc()
    let synced = false
    const provider = new HocuspocusProvider({
      url: `ws://127.0.0.1:${wsPort}`,
      name: documentId,
      document: ydoc,
      token: JSON.stringify({ slug, deviceType: 'desktop', accessToken }),
      WebSocketPolyfill: WebSocket,
      onSynced: () => {
        synced = true
      }
    })

    const deadline = Date.now() + 15_000
    while (!synced && Date.now() < deadline) await sleep(100)
    return { provider, ydoc, synced }
  }
