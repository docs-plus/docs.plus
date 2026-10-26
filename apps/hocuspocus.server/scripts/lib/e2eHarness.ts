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
import type { Subprocess } from 'bun'
import * as Y from 'yjs'

import type { prisma as Prisma } from '../../src/lib/prisma'

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
  /** The WS process, so a script can stop it alone to test an outage. */
  ws: Subprocess
  kill: () => void
  /** Throws, so each caller keeps its own exit or finally path. */
  waitUntilUp: () => Promise<void>
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
  const kill = () => {
    ws.kill()
    rest.kill()
  }
  // A guard: an early process.exit or an uncaught throw must not orphan them.
  process.once('exit', kill)

  const restUrl = `http://127.0.0.1:${restPort}`
  const waitUntilUp = async () => {
    if (!(await waitForHttp(`http://127.0.0.1:${internalPort}/metrics`))) {
      throw new Error('WS process internal listener never came up')
    }
    if (!(await waitForHttp(`${restUrl}/health`))) {
      throw new Error('REST process never came up')
    }
  }

  return { wsPort, internalPort, restPort, restUrl, ws, kill, waitUntilUp }
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

export interface DocumentFixtures {
  prefix: string
  createDocument: (
    suffix: string,
    extra?: Record<string, unknown>
  ) => Promise<{ documentId: string; slug: string; title: string }>
  cleanup: () => Promise<void>
}

/**
 * Prisma is a parameter, not an import, so the scripts that never touch rows
 * do not load it. Cleanup matches the family, so it also clears earlier runs.
 */
export const makeDocumentFixtures = (
  rest: ReturnType<typeof makeRest>,
  prisma: typeof Prisma,
  family: string
): DocumentFixtures => {
  const prefix = `${family}-${Date.now()}`
  const createdDocumentIds: string[] = []
  return {
    prefix,
    createDocument: async (suffix, extra = {}) => {
      const slug = `${prefix}-${suffix}`
      const { status, body } = await rest('/api/documents', {
        method: 'POST',
        body: JSON.stringify({ title: `Title ${suffix}`, slug, ...extra })
      })
      if (status !== 200) {
        throw new Error(`create ${suffix} failed: ${status} ${JSON.stringify(body)}`)
      }
      createdDocumentIds.push(body.data.documentId)
      return { documentId: body.data.documentId, slug: body.data.slug, title: body.data.title }
    },
    cleanup: async () => {
      await prisma.documentMetadata.deleteMany({ where: { slug: { startsWith: `${family}-` } } })
      if (createdDocumentIds.length > 0) {
        await prisma.documents.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
      }
    }
  }
}

export const titleDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] }]
})

export const paragraphDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
})

export const appendParagraph = (ydoc: Y.Doc, text: string): void => {
  const fragment = ydoc.getXmlFragment('default')
  const paragraph = new Y.XmlElement('paragraph')
  paragraph.insert(0, [new Y.XmlText(text)])
  fragment.insert(fragment.length, [paragraph])
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
    if (value !== null && accept(value)) return value
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
 * CI sets E2E_REQUIRE_AUTH=1, so a failed mint throws with its reason (#586). A throw,
 * not an exit, lets the caller's finally delete rows and close its clients.
 * Without it the mint returns null and the caller prints a skip.
 */
const failMintIfRequired = (reason: unknown): null => {
  if (process.env.E2E_REQUIRE_AUTH !== '1') return null
  throw new Error(`E2E_REQUIRE_AUTH=1, but the test user mint failed: ${String(reason)}`, {
    cause: reason
  })
}

/**
 * A verifiable identity needs a token the WS process can check. CI serves one from
 * the Supabase stub `scripts/lib/supabaseStub.ts`; a local run uses real Supabase
 * Auth. With no Auth this returns null, and the caller degrades to a skip.
 */
export const mintTestUser = async (
  prefix: string,
  serviceKey: string,
  fullName: string
): Promise<TestUser | null> => {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return failMintIfRequired('SUPABASE_URL or SUPABASE_ANON_KEY is unset')

  const email = `${prefix}@docs.plus.test`
  const password = `${prefix}-Passw0rd!`
  // The reason leaves the try first, so the catch never wraps the throw a second time.
  let reason: unknown
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })
    if (created.error || !created.data.user) {
      reason = created.error ?? 'createUser returned no user'
    } else {
      const anon = createClient(url, anonKey, { auth: { persistSession: false } })
      const signedIn = await anon.auth.signInWithPassword({ email, password })
      if (signedIn.error || !signedIn.data.session) {
        reason = signedIn.error ?? 'signInWithPassword returned no session'
      } else {
        return { id: created.data.user.id, email, accessToken: signedIn.data.session.access_token }
      }
    }
  } catch (error) {
    reason = error
  }
  return failMintIfRequired(reason)
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
export const { HocuspocusProvider } = providerModule as {
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
