/**
 * Real-infra E2E for change attribution: two signed-in collaborators, a signed-out one, a
 * reconnect that replays offline bytes, and the diff that names each block's author.
 * Standalone (not `bun test`); needs `make dev-local` and root .env.local.
 */
import { TiptapTransformer } from '@hocuspocus/transformer'
import { createClient } from '@supabase/supabase-js'
import * as Y from 'yjs'

import { prisma } from '../src/lib/prisma'
import { closeQueues, createDocumentWorker } from '../src/lib/queue'
import { disconnectRedis } from '../src/lib/redis'

const PACKAGE_ROOT = new URL('..', import.meta.url).pathname
const REPO_ROOT = new URL('../../..', import.meta.url).pathname
const PREFIX = `e2e-attribution-${Date.now()}`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const ALPHA_LIVE = 'alpha-live-paragraph'
const BETA_LIVE = 'beta-live-paragraph'
const SIGNED_OUT = 'signed-out-paragraph'
const ALPHA_OFFLINE = 'alpha-offline-paragraph'
const ORPHAN_REPLAY = 'orphan-replay-paragraph'
const BETA_RECONNECT = 'beta-reconnect-paragraph'

let passed = 0
let failed = 0
let skipped = 0
let uncovered = 0
const check = (condition: boolean, message: string) => {
  console.log(`  ${condition ? '✓' : '✗'} ${message}`)
  if (condition) passed += 1
  else failed += 1
}
const skip = (message: string) => {
  console.log(`  ⚠ skipped — ${message}`)
  skipped += 1
}
const notCovered = (message: string) => {
  console.log(`  ⚠ NOT COVERED — ${message}`)
  uncovered += 1
}

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for the attribution E2E')
  process.exit(1)
}

const freePort = (): number => {
  const probe = Bun.serve({ port: 0, fetch: () => new Response('') })
  const { port } = probe
  probe.stop(true)
  if (port === undefined) throw new Error('Bun.serve did not assign a port')
  return port
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForHttp = async (url: string, timeoutMs = 30_000): Promise<boolean> => {
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

const wsPort = freePort()
const internalPort = freePort()
const restPort = freePort()

const childEnv = {
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

const wsServer = Bun.spawn(['bun', 'src/hocuspocus.server.ts'], {
  cwd: PACKAGE_ROOT,
  env: childEnv,
  stdout: 'inherit',
  stderr: 'inherit'
})

const restServer = Bun.spawn(['bun', 'src/index.ts'], {
  cwd: PACKAGE_ROOT,
  env: childEnv,
  stdout: 'inherit',
  stderr: 'inherit'
})

const restUrl = `http://127.0.0.1:${restPort}`

interface RestResponse {
  status: number
  body: any
}

const rest = async (
  path: string,
  init: RequestInit & { auth?: string | null } = {}
): Promise<RestResponse> => {
  const { auth = SERVICE_KEY, ...requestInit } = init
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

const titleDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] }]
})

const createdDocumentIds: string[] = []

const createDocument = async (
  suffix: string,
  extra: Record<string, unknown> = {}
): Promise<{ documentId: string; slug: string }> => {
  const slug = `${PREFIX}-${suffix}`
  const { status, body } = await rest('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ title: `Title ${suffix}`, slug, ...extra })
  })
  if (status !== 200) throw new Error(`create ${suffix} failed: ${status} ${JSON.stringify(body)}`)
  createdDocumentIds.push(body.data.documentId)
  return { documentId: body.data.documentId, slug: body.data.slug }
}

const headRow = (documentId: string) =>
  prisma.documents.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' },
    select: { version: true, data: true }
  })

const decodeText = (data: Uint8Array): string => {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, new Uint8Array(data))
  return JSON.stringify(TiptapTransformer.fromYdoc(ydoc, 'default'))
}

const pollFor = async <T>(
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

/** Head content carrying every marker, which is what proves the bytes travelled. */
const headCarrying = (documentId: string, markers: string[]) =>
  pollFor(
    () => headRow(documentId),
    (row) => {
      const text = decodeText(row.data)
      return markers.every((marker) => text.includes(marker))
    }
  )

interface Binding {
  userId: string
  isAnonymous: boolean
}

const bindingFor = (documentId: string, clientId: number): Promise<Binding | null> =>
  prisma.documentClientAuthor.findFirst({
    where: { documentId, clientId: BigInt(clientId) },
    select: { userId: true, isAnonymous: true }
  })

const awaitBinding = (documentId: string, clientId: number): Promise<Binding | null> =>
  pollFor(
    () => bindingFor(documentId, clientId),
    () => true,
    20_000
  )

const appendParagraph = (ydoc: Y.Doc, text: string): void => {
  const fragment = ydoc.getXmlFragment('default')
  const paragraph = new Y.XmlElement('paragraph')
  paragraph.insert(0, [new Y.XmlText(text)])
  fragment.insert(fragment.length, [paragraph])
}

/** Everything the target lacks, which is how an offline peer hands work over. */
const encodeMissing = (source: Y.Doc, target: Y.Doc): Uint8Array =>
  Y.encodeStateAsUpdate(source, Y.encodeStateVector(target))

// Resolved against the webapp because @hocuspocus/provider is a webapp
// dependency, not a backend one. Hoisting the provider for a test-only client
// would put a client library in the server's dependency graph.
const providerModule = await import(
  Bun.resolveSync('@hocuspocus/provider', `${REPO_ROOT}apps/webapp`)
)
const { HocuspocusProvider } = providerModule as {
  HocuspocusProvider: new (config: Record<string, unknown>) => any
}

interface Session {
  provider: any
  ydoc: Y.Doc
  clientId: number
  synced: boolean
  announced: boolean
}

/** Server-side count of awareness messages, which is the only sync point for
 *  "this socket has announced its clientID". */
const awarenessMessagesSeen = async (): Promise<number> => {
  try {
    const text = await (await fetch(`http://127.0.0.1:${internalPort}/metrics`)).text()
    const line = text.split('\n').find((row) => row.startsWith('ws_awareness_updates_total '))
    return line ? Number(line.split(' ')[1]) : 0
  } catch {
    return 0
  }
}

const openProvider = async (
  documentId: string,
  slug: string,
  options: { accessToken?: string; document?: Y.Doc; name?: string } = {}
): Promise<Session> => {
  const ydoc = options.document ?? new Y.Doc()
  let synced = false
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${wsPort}`,
    name: documentId,
    document: ydoc,
    token: JSON.stringify({
      slug,
      deviceType: 'desktop',
      ...(options.accessToken ? { accessToken: options.accessToken } : {})
    }),
    WebSocketPolyfill: WebSocket,
    onSynced: () => {
      synced = true
    }
  })

  const deadline = Date.now() + 15_000
  while (!synced && Date.now() < deadline) await sleep(100)

  // Capture only trusts clientIDs a socket announced over awareness, and the
  // state y-protocols builds at construction carries clock 0, which the server
  // drops. Publishing a user field is what the editor's caret does on mount.
  const seenBefore = await awarenessMessagesSeen()
  provider.setAwarenessField('user', { name: options.name ?? 'collaborator', color: '#4b7bec' })
  const announceDeadline = Date.now() + 8_000
  let announced = false
  while (!announced && Date.now() < announceDeadline) {
    announced = (await awarenessMessagesSeen()) > seenBefore
    if (!announced) await sleep(100)
  }

  return { provider, ydoc, clientId: ydoc.clientID, synced, announced }
}

interface Actor {
  id: string
  accessToken: string
  fullName: string | null
}

// Signed-in attribution needs tokens the WS process can verify, so it needs a
// live Supabase Auth. CI points SUPABASE_URL at a closed port on purpose, so the
// signed-in checks skip and the run prints SKIPPED, never a false PASSED.
const mintUser = async (suffix: string, fullName: string): Promise<Actor | null> => {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const email = `${PREFIX}-${suffix}@docs.plus.test`
  const password = `${PREFIX}-Passw0rd!`
  try {
    const admin = createClient(url, SERVICE_KEY, { auth: { persistSession: false } })
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

    return { id: created.data.user.id, accessToken: signedIn.data.session.access_token, fullName }
  } catch {
    return null
  }
}

const deleteActors = async (actors: (Actor | null)[]): Promise<void> => {
  const url = process.env.SUPABASE_URL
  if (!url) return
  const admin = createClient(url, SERVICE_KEY, { auth: { persistSession: false } })
  for (const actor of actors) {
    if (!actor) continue
    try {
      await admin.auth.admin.deleteUser(actor.id)
    } catch {
      // the run already reported; a leftover throwaway user is not a failure
    }
  }
}

const cleanup = async () => {
  await prisma.documentMetadata.deleteMany({ where: { slug: { startsWith: 'e2e-attribution-' } } })
  if (createdDocumentIds.length > 0) {
    await prisma.documents.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  }
}

// Needs no Auth, so it asserts in CI too. A signed-out socket carries no user
// id, so capture must bind none of its clientIDs.
const runSignedOut = async (): Promise<void> => {
  const doc = await createDocument('signed-out', { content: titleDoc('Attribution Signed Out') })

  console.log('\n[2] a signed-out connection, on its own document')
  const signedOutSession = await openProvider(doc.documentId, doc.slug, { name: 'guest' })
  check(
    signedOutSession.synced && signedOutSession.announced,
    'the signed-out collaborator synced and announced its clientID'
  )
  appendParagraph(signedOutSession.ydoc, SIGNED_OUT)

  // Wait for the server's ack, then close the only socket. The close forces the
  // flush, so a head row carrying the edit proves capture had its chance to run.
  const ackDeadline = Date.now() + 10_000
  while (signedOutSession.provider.hasUnsyncedChanges && Date.now() < ackDeadline) await sleep(100)
  signedOutSession.provider.destroy()
  const flushed = await headCarrying(doc.documentId, [SIGNED_OUT])
  check(!!flushed, 'the signed-out edit persisted')
  check(
    (await bindingFor(doc.documentId, signedOutSession.clientId)) === null,
    `the signed-out clientID ${signedOutSession.clientId} is bound to nobody`
  )

  const diff = await rest(
    `/api/documents/${doc.documentId}/versions/${flushed?.version}/diff?base=1`
  )
  check(diff.status === 200, `the signed-out diff returned 200 (got ${diff.status})`)
  const data = diff.body?.data
  check(data?.unattributed === false, 'the signed-out diff aligned the stored Y items')
  const changes: any[] = data?.changes ?? []
  const authors = new Map<number, any>((data?.authors ?? []).map((a: any) => [a.clientId, a]))
  const block = changes.find((change) => String(change.after ?? '').includes(SIGNED_OUT))
  check(!!block, 'the diff lists the signed-out block')
  check(
    (block?.clientIds ?? []).includes(signedOutSession.clientId),
    'the signed-out block still names the clientID that wrote it'
  )
  check(
    !authors.has(signedOutSession.clientId),
    'the signed-out clientID reads as unattributed rather than as any account'
  )
}

const runSignedIn = async (alpha: Actor, beta: Actor): Promise<void> => {
  const doc = await createDocument('session', { content: titleDoc('Attribution Session') })

  console.log('\n[1] two signed-in collaborators on one document')
  const alphaSession = await openProvider(doc.documentId, doc.slug, {
    accessToken: alpha.accessToken,
    name: 'alpha'
  })
  const betaSession = await openProvider(doc.documentId, doc.slug, {
    accessToken: beta.accessToken,
    name: 'beta'
  })
  check(alphaSession.synced && betaSession.synced, 'both signed-in collaborators synced')
  check(
    alphaSession.announced && betaSession.announced,
    'both sockets announced their clientID over awareness'
  )
  check(
    alphaSession.clientId !== betaSession.clientId,
    `the two sockets carry different clientIDs (${alphaSession.clientId}, ${betaSession.clientId})`
  )

  appendParagraph(alphaSession.ydoc, ALPHA_LIVE)
  appendParagraph(betaSession.ydoc, BETA_LIVE)

  const alphaBinding = await awaitBinding(doc.documentId, alphaSession.clientId)
  const betaBinding = await awaitBinding(doc.documentId, betaSession.clientId)
  check(!!alphaBinding && !!betaBinding, 'both clientIDs were captured while the sockets were live')
  check(alphaBinding?.userId === alpha.id, 'the first editor owns the clientID it typed under')
  check(betaBinding?.userId === beta.id, 'the second editor owns the clientID it typed under')
  check(
    alphaBinding?.isAnonymous === false && betaBinding?.isAnonymous === false,
    'neither signed-in binding is flagged anonymous'
  )

  console.log('\n[3] a reconnect replaying edits made under another clientID')
  alphaSession.provider.destroy()
  betaSession.provider.destroy()
  const flushed = await headCarrying(doc.documentId, [ALPHA_LIVE, BETA_LIVE])
  check(!!flushed, 'the two live edits persisted when the last socket closed')

  // Two sets of bytes the reconnecting socket does not own: one from an account
  // the server already knows, one from a device that never connected. Only the
  // second can expose a broken filter — a duplicate key hides the first.
  appendParagraph(alphaSession.ydoc, ALPHA_OFFLINE)
  const orphanDoc = new Y.Doc()
  Y.applyUpdate(orphanDoc, Y.encodeStateAsUpdate(betaSession.ydoc))
  appendParagraph(orphanDoc, ORPHAN_REPLAY)

  // A page reload: same account, fresh Y.Doc, fresh clientID, and the state the
  // tab held when it dropped.
  const reconnectDoc = new Y.Doc()
  Y.applyUpdate(reconnectDoc, Y.encodeStateAsUpdate(betaSession.ydoc))
  const betaAgain = await openProvider(doc.documentId, doc.slug, {
    accessToken: beta.accessToken,
    document: reconnectDoc,
    name: 'beta'
  })
  check(betaAgain.synced && betaAgain.announced, 'the second editor reconnected')
  check(
    betaAgain.clientId !== betaSession.clientId,
    `the reconnect took a new clientID (${betaSession.clientId} → ${betaAgain.clientId})`
  )

  // One transaction, so the peer bytes and this socket's own keystroke reach the
  // server as a single update. Split across two, the second update is skipped
  // once the socket's clientID is bound and the ownership filter never runs.
  reconnectDoc.transact(() => {
    Y.applyUpdate(reconnectDoc, encodeMissing(alphaSession.ydoc, reconnectDoc))
    Y.applyUpdate(reconnectDoc, encodeMissing(orphanDoc, reconnectDoc))
    appendParagraph(reconnectDoc, BETA_RECONNECT)
  })

  // Proves capture ran on the very update that carried the foreign bytes.
  // Without that proof, "nothing was bound" would pass for the boring reason
  // that the guard bailed out before reading the update at all.
  const reconnectBinding = await awaitBinding(doc.documentId, betaAgain.clientId)
  check(
    reconnectBinding?.userId === beta.id,
    'the reconnected socket bound its own new clientID to the same account'
  )

  betaAgain.provider.destroy()
  const replayed = await headCarrying(doc.documentId, [
    ALPHA_OFFLINE,
    ORPHAN_REPLAY,
    BETA_RECONNECT
  ])
  check(!!replayed, 'the replayed offline bytes reached the server over the reconnected socket')

  const orphanBinding = await bindingFor(doc.documentId, orphanDoc.clientID)
  check(
    orphanBinding === null,
    `the never-connected clientID ${orphanDoc.clientID} was not credited to the reconnecting editor`
  )
  const alphaAfterReplay = await bindingFor(doc.documentId, alphaSession.clientId)
  check(
    alphaAfterReplay?.userId === alpha.id,
    'the first editor still owns its clientID after the replay'
  )

  console.log('\n[4] the version diff names the author of each block')
  const head = await headRow(doc.documentId)
  const diff = await rest(`/api/documents/${doc.documentId}/versions/${head?.version}/diff?base=1`)
  check(diff.status === 200, `the diff returned 200 (got ${diff.status})`)
  const data = diff.body?.data
  check(data?.unattributed === false, 'the diff aligned the stored Y items with the decoded blocks')
  check((data?.totalChanges ?? 0) > 0, `the diff reports changed blocks (${data?.totalChanges})`)
  console.log(`  authors: ${JSON.stringify(data?.authors ?? [])}`)

  const changes: any[] = data?.changes ?? []
  const authors = new Map<number, any>((data?.authors ?? []).map((a: any) => [a.clientId, a]))
  const blockFor = (marker: string) =>
    changes.find((change) => String(change.after ?? '').includes(marker))

  const expectSoleAuthor = (marker: string, clientId: number, actor: Actor, label: string) => {
    const block = blockFor(marker)
    check(!!block, `the diff lists the ${label} block`)
    check(
      JSON.stringify(block?.clientIds) === JSON.stringify([clientId]),
      `the ${label} block names only clientID ${clientId} (got ${JSON.stringify(block?.clientIds)})`
    )
    check(
      authors.get(clientId)?.user?.id === actor.id,
      `the ${label} block resolves to the account that typed it`
    )
    check(
      authors.get(clientId)?.user?.full_name === actor.fullName,
      `the ${label} author carries the display name from public.users`
    )
  }

  expectSoleAuthor(ALPHA_LIVE, alphaSession.clientId, alpha, 'first editor')
  expectSoleAuthor(BETA_LIVE, betaSession.clientId, beta, 'second editor')
  expectSoleAuthor(BETA_RECONNECT, betaAgain.clientId, beta, 'post-reconnect')
  expectSoleAuthor(ALPHA_OFFLINE, alphaSession.clientId, alpha, 'replayed offline')

  const orphanBlock = blockFor(ORPHAN_REPLAY)
  check(!!orphanBlock, 'the diff lists the replayed orphan block')
  check(
    (orphanBlock?.clientIds ?? []).includes(orphanDoc.clientID),
    'the orphan block still names the clientID that wrote it'
  )
  check(
    !authors.has(orphanDoc.clientID),
    'the orphan clientID reads as unattributed rather than as the reconnecting editor'
  )
}

console.log('E2E: change attribution (real REST + WS + Redis + Postgres + Supabase Auth)')
await cleanup()

const worker = createDocumentWorker()
await worker.waitUntilReady()

if (!(await waitForHttp(`http://127.0.0.1:${internalPort}/metrics`))) {
  console.error('WS process internal listener never came up')
  wsServer.kill()
  restServer.kill()
  process.exit(1)
}
if (!(await waitForHttp(`${restUrl}/health`))) {
  console.error('REST process never came up')
  wsServer.kill()
  restServer.kill()
  process.exit(1)
}

const alpha = await mintUser('alpha', 'Attribution Alpha')
const beta = await mintUser('beta', 'Attribution Beta')

try {
  await runSignedOut()

  if (!alpha || !beta) {
    console.log('\n[1] [3] [4] signed-in session')
    skip('no verifiable Supabase sessions; every clientID would be captured as nobody')
  } else {
    await runSignedIn(alpha, beta)
  }

  console.log('\n[5] time-range window')
  notCovered('no version surface accepts a date bound, so there is no time-range query to exercise')
} catch (error) {
  console.error('\nE2E aborted:', error)
  failed += 1
} finally {
  await deleteActors([alpha, beta])
  await cleanup()
  wsServer.kill()
  restServer.kill()
  await worker.close()
  await closeQueues()
  await prisma.$disconnect()
  await disconnectRedis()
}

console.log(`\n${passed} passed, ${failed} failed`)
if (skipped > 0) console.log(`${skipped} check group(s) skipped`)
if (uncovered > 0) console.log(`${uncovered} scenario(s) NOT COVERED`)
// SKIPPED exits 0: CI has no Auth until #586, and a non-zero exit would fail
// backend-e2e on every main push. NOT COVERED stays a note, not a skip.
const outcome = failed > 0 ? 'FAILED' : skipped > 0 || passed === 0 ? 'SKIPPED' : 'PASSED'
console.log(`\nattribution E2E: ${outcome}`)
process.exit(failed > 0 ? 1 : 0)
