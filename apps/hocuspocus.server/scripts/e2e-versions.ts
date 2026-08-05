/**
 * Real-infra E2E for the Document Versions API:
 * REST → the WS process's internal listener → openDirectConnection → transact →
 * BullMQ worker → Postgres, plus the stateless `history.revert` op, with real
 * collaboration clients attached.
 *
 * Run as a standalone process (NOT `bun test`): BullMQ's worker run-loop does not
 * progress under the bun test runner, but works in a normal process (as in prod).
 * Needs the `make dev-local` docker services (Postgres + Redis) and root .env.local.
 */
import { OutgoingMessage } from '@hocuspocus/server'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { createClient } from '@supabase/supabase-js'
import * as Y from 'yjs'

import { prisma } from '../src/lib/prisma'
import { closeQueues, createDocumentWorker, StoreDocumentQueue } from '../src/lib/queue'
import { disconnectRedis } from '../src/lib/redis'

const PACKAGE_ROOT = new URL('..', import.meta.url).pathname
const REPO_ROOT = new URL('../../..', import.meta.url).pathname
const PREFIX = `e2e-versions-${Date.now()}`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let failed = false
let skipped = 0
const check = (condition: boolean, message: string) => {
  console.log(`  ${condition ? '✓' : '✗'} ${message}`)
  if (!condition) failed = true
}
const skip = (message: string) => {
  console.log(`  ⚠ skipped — ${message}`)
  skipped += 1
}

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for the versions E2E')
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

const paragraphDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
})

const createdDocumentIds: string[] = []

const createDocument = async (
  suffix: string,
  extra: Record<string, unknown> = {}
): Promise<{ documentId: string; slug: string; title: string }> => {
  const slug = `${PREFIX}-${suffix}`
  const { status, body } = await rest('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ title: `Title ${suffix}`, slug, ...extra })
  })
  if (status !== 200) throw new Error(`create ${suffix} failed: ${status} ${JSON.stringify(body)}`)
  createdDocumentIds.push(body.data.documentId)
  return { documentId: body.data.documentId, slug: body.data.slug, title: body.data.title }
}

const rowCount = (documentId: string) => prisma.documents.count({ where: { documentId } })

const headRow = (documentId: string) =>
  prisma.documents.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' },
    select: { version: true, data: true, commitMessage: true }
  })

const versionRow = (documentId: string, version: number) =>
  prisma.documents.findFirst({
    where: { documentId, version },
    select: { version: true, data: true, commitMessage: true, trigger: true, triggeredBy: true }
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

/** Store job ids for one document, newest last. The suffix is what the pins read. */
const storeJobIds = async (documentId: string): Promise<string[]> => {
  const jobs = await StoreDocumentQueue.getJobs(
    ['completed', 'waiting', 'active', 'delayed', 'failed'],
    0,
    500
  )
  return jobs
    .filter((job) => job?.data?.documentName === documentId)
    .map((job) => String(job.id))
    .sort()
}

const appendParagraph = (ydoc: Y.Doc, text: string): void => {
  const fragment = ydoc.getXmlFragment('default')
  const paragraph = new Y.XmlElement('paragraph')
  paragraph.insert(0, [new Y.XmlText(text)])
  fragment.insert(fragment.length, [paragraph])
}

// Resolved against the webapp because @hocuspocus/provider is a webapp
// dependency, not a backend one — hoisting it for a test-only client would put
// a client library in the server's dependency graph.
const providerModule = await import(
  Bun.resolveSync('@hocuspocus/provider', `${REPO_ROOT}apps/webapp`)
)
const { HocuspocusProvider } = providerModule as {
  HocuspocusProvider: new (config: Record<string, unknown>) => any
}

interface Session {
  provider: any
  ydoc: Y.Doc
  synced: boolean
  stateless: any[]
}

const openProvider = async (
  documentId: string,
  slug: string,
  options: { accessToken?: string } = {}
): Promise<Session> => {
  const ydoc = new Y.Doc()
  const stateless: any[] = []
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
    },
    onStateless: ({ payload }: { payload: string }) => {
      try {
        stateless.push(JSON.parse(payload))
      } catch {
        // not a history envelope
      }
    }
  })

  const deadline = Date.now() + 15_000
  while (!synced && Date.now() < deadline) await sleep(100)
  return { provider, ydoc, synced, stateless }
}

const revertOverStateless = async (
  session: Session,
  documentId: string,
  version: number
): Promise<any | null> => {
  session.stateless.length = 0
  session.provider.sendStateless(
    JSON.stringify({ msg: 'history', type: 'history.revert', documentId, version })
  )

  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    const hit = session.stateless.find(
      (message) => message?.msg === 'history.response' && message?.type === 'history.revert'
    )
    if (hit) return hit
    await sleep(50)
  }
  return null
}

interface TestUser {
  id: string
  email: string
  accessToken: string
}

// Attribution needs a token the WS process can actually verify, which is a live
// Supabase Auth. CI points SUPABASE_URL at a closed port on purpose, so every
// user-identity assertion below degrades to a skip rather than a false green.
const mintTestUser = async (): Promise<TestUser | null> => {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const email = `${PREFIX}@docs.plus.test`
  const password = `${PREFIX}-Passw0rd!`
  try {
    const admin = createClient(url, SERVICE_KEY, { auth: { persistSession: false } })
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Versions Actor' }
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

const deleteTestUser = async (user: TestUser | null): Promise<void> => {
  const url = process.env.SUPABASE_URL
  if (!user || !url) return
  try {
    const admin = createClient(url, SERVICE_KEY, { auth: { persistSession: false } })
    await admin.auth.admin.deleteUser(user.id)
  } catch {
    // the run already reported; a leftover throwaway user is not a failure
  }
}

const cleanup = async () => {
  await prisma.documentMetadata.deleteMany({ where: { slug: { startsWith: 'e2e-versions-' } } })
  if (createdDocumentIds.length > 0) {
    await prisma.documents.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  }
}

console.log('E2E: document versions (real REST + WS + Redis + Postgres)')
await cleanup()

let worker = createDocumentWorker()
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

const actor = await mintTestUser()

try {
  // 1. One document, three provenances: a collaborator's edit, a service
  //    injection and a named checkpoint.
  console.log('\n[1] three-trigger attribution through the REST list')
  {
    const doc = await createDocument('attribution', { content: titleDoc('Attribution') })

    if (!actor) {
      skip('no verifiable Supabase session; the websocket row cannot carry a user id')
    } else {
      const session = await openProvider(doc.documentId, doc.slug, {
        accessToken: actor.accessToken
      })
      check(session.synced, 'the signed-in collaborator synced against the real WS server')
      appendParagraph(session.ydoc, 'edit-by-actor')
      // destroy() is the last connection closing, which flushes the pending
      // debounced store immediately instead of waiting out the 10s window.
      session.provider.destroy()

      const wsRow = await pollFor(
        () => versionRow(doc.documentId, 2),
        (row) => row.trigger === 'websocket'
      )
      check(!!wsRow, 'the collaborator edit persisted as a websocket-triggered version')
      check(wsRow?.triggeredBy === actor.id, 'the websocket row is attributed to the editor')
    }

    const inject = await rest(`/api/documents/${doc.documentId}/content?mode=append`, {
      method: 'PATCH',
      body: JSON.stringify({ content: paragraphDoc('injected-by-service') })
    })
    check(inject.status === 200, `the unnamed service PATCH returned 200 (got ${inject.status})`)
    const apiRow = await pollFor(
      () => headRow(doc.documentId),
      (row) => decodeText(row.data).includes('injected-by-service')
    )
    check(!!apiRow, 'the service injection persisted')

    const checkpoint = await rest(`/api/documents/${doc.documentId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Reviewed draft' })
    })
    check(checkpoint.status === 200, `the checkpoint returned 200 (got ${checkpoint.status})`)
    const namedRow = await pollFor(
      () => headRow(doc.documentId),
      (row) => row.commitMessage === 'Reviewed draft'
    )
    check(!!namedRow, 'the checkpoint minted a named version')

    const list = await rest(`/api/documents/${doc.documentId}/versions`)
    check(list.status === 200, `the version list returned 200 (got ${list.status})`)
    const versions: any[] = list.body?.data?.versions ?? []
    const triggers = versions.map((version) => version.trigger)
    check(triggers[0] === 'checkpoint', 'the newest listed version is the checkpoint')
    check(triggers.includes('api'), 'the service injection is listed as an api version')
    check(
      versions.some((version) => version.name === 'Reviewed draft'),
      'the checkpoint name is listed'
    )
    check(
      versions[versions.length - 1]?.trigger === 'api',
      'the create-with-content row is listed as the oldest api version'
    )

    if (actor) {
      check(
        triggers.includes('websocket'),
        'the collaborator edit is listed as a websocket version'
      )
      const wsListed = versions.find((version) => version.trigger === 'websocket')
      const profile = wsListed?.triggeredBy
      if (profile) {
        check(profile.id === actor.id, 'the websocket row embeds the editor profile')
        check(
          profile.full_name === 'Versions Actor',
          'the embedded profile carries the public.users columns'
        )
        check(
          (wsListed.contributors ?? []).some((entry: any) => entry.id === actor.id),
          'the editor is listed among the version contributors'
        )
      } else {
        skip('the profile lookup returned nothing; attribution rendered as bare uids')
      }
      const checkpointListed = versions.find((version) => version.trigger === 'checkpoint')
      check(
        checkpointListed?.triggeredBy === null,
        'the service checkpoint stays unattributed rather than crediting the owner'
      )
    }
  }

  // 2. The dedupe pin: the disconnect flush after a named injection must reuse
  //    the widened job id instead of minting a second, unnamed row.
  console.log('\n[2] a named injection mints exactly one row')
  {
    const doc = await createDocument('dedupe', { content: titleDoc('Dedupe') })
    const session = await openProvider(doc.documentId, doc.slug)
    check(session.synced, 'a collaborator is connected while the injection lands')

    const before = await rowCount(doc.documentId)
    const jobsBefore = await storeJobIds(doc.documentId)

    const patch = await rest(`/api/documents/${doc.documentId}/content?mode=append`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: paragraphDoc('named-inject'),
        commitMessage: 'Named injection'
      })
    })
    check(patch.status === 200, `the named PATCH returned 200 (got ${patch.status})`)

    const named = await pollFor(
      () => headRow(doc.documentId),
      (row) => row.commitMessage === 'Named injection'
    )
    check(!!named, 'the named row landed')

    // Well past the immediate disconnect flush and its worker round-trip.
    await sleep(4_000)
    const after = await rowCount(doc.documentId)
    const jobsAfter = await storeJobIds(doc.documentId)

    check(after === before + 1, `exactly one row was added (${before} → ${after})`)
    check(
      jobsAfter.length === jobsBefore.length + 1,
      `the disconnect flush enqueued no second job (${jobsBefore.length} → ${jobsAfter.length})`
    )
    const trailing = await headRow(doc.documentId)
    check(
      trailing?.commitMessage === 'Named injection',
      'the head is still the named row, with no unnamed row behind it'
    )
    session.provider.destroy()
  }

  // 3. The force pin: a checkpoint that changes nothing has the same bytes as
  //    the autosave it follows, so only the widened job id keeps it off the
  //    ten-second dedupe window.
  console.log('\n[3] a checkpoint byte-identical to a fresh autosave still lands')
  {
    const doc = await createDocument('force', { content: titleDoc('Force') })
    const session = await openProvider(doc.documentId, doc.slug)
    check(session.synced, 'the collaborator synced before editing')

    // buildStoreJobId buckets by floor(now / 10s) and the store debounce is
    // exactly 10s, so an edit made early in a bucket flushes at the same offset
    // one bucket later — leaving the checkpoint most of that bucket to land in.
    const offsetIntoBucket = Date.now() % 10_000
    if (offsetIntoBucket > 1_500) await sleep(10_000 - offsetIntoBucket + 600)

    appendParagraph(session.ydoc, 'typed-then-checkpointed')
    const autosaved = await pollFor(
      () => headRow(doc.documentId),
      (row) => decodeText(row.data).includes('typed-then-checkpointed'),
      20_000
    )
    check(!!autosaved, 'the debounced autosave persisted while the collaborator stayed connected')
    const jobsAfterAutosave = await storeJobIds(doc.documentId)

    const checkpoint = await rest(`/api/documents/${doc.documentId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Same bytes' })
    })
    check(checkpoint.status === 200, `the checkpoint returned 200 (got ${checkpoint.status})`)

    const namedRow = await pollFor(
      () => headRow(doc.documentId),
      (row) => row.commitMessage === 'Same bytes'
    )
    check(!!namedRow, 'the checkpoint landed a named row despite changing nothing')
    check(
      (namedRow?.version ?? 0) === (autosaved?.version ?? 0) + 1,
      'the named row sits directly on top of the autosave it duplicates'
    )

    const jobsAfterCheckpoint = await storeJobIds(doc.documentId)
    const added = jobsAfterCheckpoint.filter((id) => !jobsAfterAutosave.includes(id))
    const collided = added.some((id) =>
      jobsAfterAutosave.some((autosaveId) => id.startsWith(`${autosaveId}-`))
    )
    // Same document, same ten-second window, same byte hash: the only thing
    // separating the two job ids is the force key.
    check(
      collided,
      'the checkpoint job id is the autosave job id plus a force key, so the bytes really collided'
    )
    session.provider.destroy()
  }

  // 4. A restore has to bank the unsaved debounce-window work before it
  //    overwrites it, and bank it somewhere a dead worker cannot lose.
  console.log('\n[4] restore banks unsaved work before overwriting it')
  {
    const doc = await createDocument('restore', { content: titleDoc('Original Z') })
    const session = await openProvider(doc.documentId, doc.slug)
    check(session.synced, 'the collaborator synced before typing')

    appendParagraph(session.ydoc, 'unsaved-X')
    appendParagraph(session.ydoc, 'unsaved-Y')
    check(
      (await rowCount(doc.documentId)) === 1,
      'the typed work is still only in the live document'
    )

    // Pausing as well as closing: the durability claim is about nothing draining
    // the queue, and a dev stack on the same Redis would otherwise drain it.
    await worker.close()
    await StoreDocumentQueue.pause()

    const restore = await rest(`/api/documents/${doc.documentId}/versions/1/restore`, {
      method: 'POST'
    })
    check(restore.status === 200, `the restore returned 200 (got ${restore.status})`)
    check(restore.body?.data?.restoredFrom === 1, 'the response names the restored version')
    check(restore.body?.data?.backupVersion === 2, 'the response names the backup version')

    const backup = await versionRow(doc.documentId, 2)
    check(!!backup, 'the pre-restore backup row exists with the worker down')
    check(
      backup?.commitMessage === 'Before restore of version 1',
      'the backup row is named after the restore it precedes'
    )
    const backupText = backup ? decodeText(backup.data) : ''
    check(
      backupText.includes('unsaved-X') && backupText.includes('unsaved-Y'),
      'the backup captured both unsaved paragraphs'
    )

    await sleep(2_000)
    const withWorkerDown = await rowCount(doc.documentId)
    check(
      withWorkerDown === 2,
      `the restore itself did not persist while the worker was down (${withWorkerDown} rows)`
    )

    await StoreDocumentQueue.resume()
    worker = createDocumentWorker()
    await worker.waitUntilReady()

    const restored = await pollFor(
      () => headRow(doc.documentId),
      (row) => row.commitMessage === 'Restored version 1'
    )
    check(!!restored, 'the restore row landed once the worker came back')
    check((restored?.version ?? 0) === 3, 'the restore row sits above the backup, not below it')
    const restoredText = restored ? decodeText(restored.data) : ''
    check(restoredText.includes('Original Z'), 'the restored content is the target version')
    check(
      !restoredText.includes('unsaved-X'),
      'the restored content dropped the work the backup banked'
    )
    session.provider.destroy()
  }

  // 5. The head is the base a cold load reads, so only older rows are prunable.
  console.log('\n[5] deleting versions')
  {
    const doc = await createDocument('delete', { content: titleDoc('Delete') })
    for (const text of ['second', 'third']) {
      await rest(`/api/documents/${doc.documentId}/content?mode=append`, {
        method: 'PATCH',
        body: JSON.stringify({ content: paragraphDoc(text) })
      })
      await pollFor(
        () => headRow(doc.documentId),
        (row) => decodeText(row.data).includes(text)
      )
    }

    const headVersion = (await headRow(doc.documentId))?.version ?? 0
    check(headVersion >= 3, `the document has at least three versions (${headVersion})`)

    const contentBefore = await rest(`/api/documents/${doc.documentId}/content`)
    const deleteHead = await rest(`/api/documents/${doc.documentId}/versions/${headVersion}`, {
      method: 'DELETE'
    })
    check(deleteHead.status === 409, `deleting the head returned 409 (got ${deleteHead.status})`)
    check(deleteHead.body?.error?.code === 'CONFLICT', 'the 409 carries the CONFLICT envelope')
    check(
      (await versionRow(doc.documentId, headVersion)) !== null,
      'the head row survived the refused delete'
    )

    const deleteOlder = await rest(`/api/documents/${doc.documentId}/versions/2`, {
      method: 'DELETE'
    })
    check(
      deleteOlder.status === 200,
      `deleting a non-head returned 200 (got ${deleteOlder.status})`
    )
    check((await versionRow(doc.documentId, 2)) === null, 'the non-head row is gone')

    const contentAfter = await rest(`/api/documents/${doc.documentId}/content`)
    check(
      JSON.stringify(contentAfter.body?.data?.content) ===
        JSON.stringify(contentBefore.body?.data?.content),
      'the document content is byte-identical after pruning an older version'
    )
  }

  // 6. Every version surface is service-role only and blind to tombstones.
  console.log('\n[6] rejected callers write nothing')
  {
    const doc = await createDocument('denied', { content: titleDoc('Denied') })
    const head = await headRow(doc.documentId)
    const before = await rowCount(doc.documentId)

    const surfaces = (auth: string | null) => [
      rest(`/api/documents/${doc.documentId}/versions`, { auth }),
      rest(`/api/documents/${doc.documentId}/versions`, {
        method: 'POST',
        auth,
        body: JSON.stringify({ name: 'nope' })
      }),
      rest(`/api/documents/${doc.documentId}/versions/1`, { auth }),
      rest(`/api/documents/${doc.documentId}/versions/1`, { method: 'DELETE', auth }),
      rest(`/api/documents/${doc.documentId}/versions/1/restore`, { method: 'POST', auth })
    ]

    const denied = await Promise.all(surfaces('not-the-key'))
    check(
      denied.every((response) => response.status === 401),
      `every version route rejected a wrong bearer (${denied.map((r) => r.status).join(',')})`
    )

    await prisma.documentMetadata.update({
      where: { documentId: doc.documentId },
      data: { deletedAt: new Date() }
    })

    const tombstoned = await Promise.all(surfaces(SERVICE_KEY))
    check(
      tombstoned.every((response) => response.status === 404),
      `every version route 404s a tombstoned document (${tombstoned.map((r) => r.status).join(',')})`
    )

    await sleep(1_000)
    check((await rowCount(doc.documentId)) === before, 'no version row was added or removed')
    const stillHead = await headRow(doc.documentId)
    check(stillHead?.version === head?.version, 'the head version is unchanged')
  }

  // 7. The stateless revert op is the one write path that never passes through
  //    MessageReceiver, so it carries its own identity and readOnly gates.
  console.log('\n[7] stateless revert gates')
  {
    const doc = await createDocument('stateless', { content: titleDoc('Stateless') })
    const anonymous = await openProvider(doc.documentId, doc.slug)
    check(anonymous.synced, 'an anonymous collaborator synced')

    const before = await rowCount(doc.documentId)

    const anonReply = await revertOverStateless(anonymous, doc.documentId, 1)
    check(anonReply?.error === 'history_failed', 'an anonymous revert is refused')
    check(anonReply?.reason === 'unauthorized', 'the refusal reason is unauthorized')

    const mismatch = await revertOverStateless(anonymous, 'notThisRoomsId12345', 1)
    check(mismatch?.error === 'history_failed', 'a room mismatch is refused')
    check(mismatch?.reason === undefined, 'the mismatch refusal carries no machine reason')
    anonymous.provider.destroy()

    if (!actor) {
      skip('no verifiable Supabase session; the read-only gate needs a signed-in non-owner')
    } else {
      const locked = await createDocument('readonly', { content: titleDoc('Locked') })
      await prisma.documentMetadata.update({
        where: { documentId: locked.documentId },
        data: { readOnly: true }
      })

      const viewer = await openProvider(locked.documentId, locked.slug, {
        accessToken: actor.accessToken
      })
      check(viewer.synced, 'a signed-in viewer synced against the read-only document')

      const lockedBefore = await rowCount(locked.documentId)
      const viewerReply = await revertOverStateless(viewer, locked.documentId, 1)
      check(viewerReply?.error === 'history_failed', 'a read-only revert is refused')
      check(viewerReply?.reason === 'read-only', 'the refusal reason is read-only')
      await sleep(1_000)
      check(
        (await rowCount(locked.documentId)) === lockedBefore,
        'the refused read-only revert wrote nothing'
      )
      viewer.provider.destroy()
    }

    await sleep(1_000)
    check((await rowCount(doc.documentId)) === before, 'the refused reverts wrote nothing')
  }

  // 8. The relay is an unauthenticated fan-out, so its envelope is the whole
  //    access-control surface. Every check reads the counter delta: an absent
  //    broadcast alone also passes on a misencoded frame or a wrong room. Redis is
  //    off outside production, so this proves the local room only.
  console.log('\n[8] stateless relay allowlist')
  {
    const droppedTotal = async (reason: string) => {
      const body = await (await fetch(`http://127.0.0.1:${internalPort}/metrics`)).text()
      const line = body
        .split('\n')
        .find((row) => row.startsWith(`stateless_relay_dropped_total{reason="${reason}"}`))
      return line ? Number(line.split(' ').pop()) : 0
    }

    const doc = await createDocument('relay', { content: titleDoc('Relay') })
    const attacker = await openProvider(doc.documentId, doc.slug)
    const victim = await openProvider(doc.documentId, doc.slug)
    check(attacker.synced && victim.synced, 'two anonymous collaborators synced')

    // A forged access event is what the webapp follows into exitPrivateDocument.
    victim.stateless.length = 0
    let dropped = await droppedTotal('type-not-allowed')
    attacker.provider.sendStateless(JSON.stringify({ type: 'private', state: true, ownerId: null }))
    await sleep(1_000)
    check(
      !victim.stateless.some((m) => m?.type === 'private'),
      'a forged private access event is not relayed'
    )
    check((await droppedTotal('type-not-allowed')) === dropped + 1, 'the forgery was counted')

    // The webapp reads `msg` before `type`, so an allowlisted type still carries a
    // forged save confirmation unless the guard refuses any `msg` it did not name.
    victim.stateless.length = 0
    dropped = await droppedTotal('type-not-allowed')
    attacker.provider.sendStateless(
      JSON.stringify({ type: 'docTitle', msg: 'document:saved', documentId: doc.documentId })
    )
    await sleep(1_000)
    check(
      !victim.stateless.some((m) => m?.msg === 'document:saved'),
      'a forged save confirmation is not relayed'
    )
    check(
      (await droppedTotal('type-not-allowed')) === dropped + 1,
      'the forged save confirmation was counted'
    )

    // Positive control AFTER the negatives: without it they pass on a socket that
    // was never listening.
    victim.stateless.length = 0
    attacker.provider.sendStateless(
      JSON.stringify({ type: 'docTitle', state: { title: 'relayed' } })
    )
    const deadline = Date.now() + 5_000
    let sawTitle = false
    while (!sawTitle && Date.now() < deadline) {
      // Asserts `state` too: only the whole-object re-stringify carries it, so a
      // typed envelope rebuilt in the relay arm would drop the title silently.
      sawTitle = victim.stateless.some(
        (m) => m?.type === 'docTitle' && m?.state?.title === 'relayed'
      )
      await sleep(50)
    }
    check(sawTitle, 'docTitle still relays')

    // Type 6 never enters onStateless. The raw frame rides the already-authenticated
    // socket; the refusal closes the attacker's document connection, so it goes last.
    victim.stateless.length = 0
    dropped = await droppedTotal('broadcast-frame')
    attacker.provider.configuration.websocketProvider.webSocket.send(
      new OutgoingMessage(doc.documentId)
        .writeBroadcastStateless(JSON.stringify({ type: 'private', state: true, ownerId: null }))
        .toUint8Array()
    )
    await sleep(1_000)
    check(
      !victim.stateless.some((m) => m?.type === 'private'),
      'a raw BroadcastStateless frame is not relayed'
    )
    check(
      (await droppedTotal('broadcast-frame')) === dropped + 1,
      'the raw BroadcastStateless frame was refused'
    )

    attacker.provider.destroy()
    victim.provider.destroy()
  }
} catch (error) {
  console.error('\nE2E aborted:', error)
  failed = true
} finally {
  await StoreDocumentQueue.resume().catch(() => {})
  await deleteTestUser(actor)
  await cleanup()
  wsServer.kill()
  restServer.kill()
  await worker.close()
  await closeQueues()
  await prisma.$disconnect()
  await disconnectRedis()
}

if (skipped > 0) console.log(`\n${skipped} check group(s) skipped`)
console.log(failed ? '\nversions E2E: FAILED' : '\nversions E2E: PASSED')
process.exit(failed ? 1 : 0)
