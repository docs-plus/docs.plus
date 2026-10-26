/**
 * Real-infra E2E for the Document Versions API. The path is REST → the WS
 * process's internal listener → openDirectConnection → transact → BullMQ worker →
 * Postgres. It also covers the stateless `history.revert` op, with real
 * collaboration clients attached.
 *
 * Run as a standalone process, NOT `bun test`. BullMQ's worker run-loop does not
 * progress under the bun test runner. It works in a normal process, as in prod.
 * Needs the `make dev-local` docker services (Postgres + Redis) and root .env.local.
 */
import { OutgoingMessage } from '@hocuspocus/server'
import * as Y from 'yjs'

import { prisma } from '../src/lib/prisma'
import { closeQueues, createDocumentWorker, StoreDocumentQueue } from '../src/lib/queue'
import { disconnectRedis } from '../src/lib/redis'
import {
  appendParagraph,
  createTally,
  decodeText,
  deleteTestUser,
  HocuspocusProvider,
  makeDocumentFixtures,
  makeRest,
  mintTestUser,
  paragraphDoc,
  pollFor,
  sleep,
  spawnServers,
  type TestUser,
  titleDoc,
  waitForHttp
} from './lib/e2eHarness'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const { check, skip, outcome } = createTally()

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for the versions E2E')
  process.exit(1)
}

const { wsPort, internalPort, restUrl, kill: killServers } = spawnServers()

const rest = makeRest(restUrl, SERVICE_KEY)
const {
  prefix: PREFIX,
  createDocument,
  cleanup
} = makeDocumentFixtures(rest, prisma, 'e2e-versions')

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

interface Session {
  provider: any
  ydoc: Y.Doc
  synced: boolean
  authFailed: boolean
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
  let authFailed = false
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
    onAuthenticationFailed: () => {
      authFailed = true
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
  while (!synced && !authFailed && Date.now() < deadline) await sleep(100)
  return { provider, ydoc, synced, authFailed, stateless }
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

console.log('E2E: document versions (real REST + WS + Redis + Postgres)')
await cleanup()

let worker = createDocumentWorker()
await worker.waitUntilReady()

if (!(await waitForHttp(`http://127.0.0.1:${internalPort}/metrics`))) {
  console.error('WS process internal listener never came up')
  killServers()
  process.exit(1)
}
if (!(await waitForHttp(`${restUrl}/health`))) {
  console.error('REST process never came up')
  killServers()
  process.exit(1)
}

// Attribution needs a token the WS process can verify. CI serves one from the
// Supabase stub scripts/lib/supabaseStub.ts. With no Auth reachable, every
// user-identity assertion below degrades to a skip, or fails under E2E_REQUIRE_AUTH.
let actor: TestUser | null = null

try {
  actor = await mintTestUser(PREFIX, SERVICE_KEY, 'Versions Actor')

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
      // A let loses its narrowing inside the callback below, so a const carries the id.
      const actorId = actor.id
      if (profile) {
        check(profile.id === actorId, 'the websocket row embeds the editor profile')
        check(
          profile.full_name === 'Versions Actor',
          'the embedded profile carries the public.users columns'
        )
        check(
          (wsListed.contributors ?? []).some((entry: any) => entry.id === actorId),
          'the editor is listed among the version contributors'
        )
      } else {
        check(false, 'the profile lookup returned nothing; attribution rendered as bare uids')
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
  //    the autosave it follows. Only the widened job id keeps that checkpoint
  //    off the ten-second dedupe window.
  console.log('\n[3] a checkpoint byte-identical to a fresh autosave still lands')
  {
    const doc = await createDocument('force', { content: titleDoc('Force') })
    const session = await openProvider(doc.documentId, doc.slug)
    check(session.synced, 'the collaborator synced before editing')

    // buildStoreJobId buckets by floor(now / 10s) and the store debounce is
    // exactly 10s. An edit made early in a bucket flushes at the same offset one
    // bucket later. That leaves the checkpoint most of that bucket to land in.
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
    // the queue. A dev stack on the same Redis would otherwise drain the queue.
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
  //    It also pins the WS Read-only lock and Private deny with anonymous sockets.
  console.log('\n[7] stateless revert and WS access gates')
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

    // An anonymous socket is a non-owner, so the WS access gates run in CI without
    // Auth. The unlocked control runs last: without it, a broken socket also passes.
    const relays = async (documentId: string, slug: string, marker: string) => {
      const writer = await openProvider(documentId, slug)
      const observer = await openProvider(documentId, slug)
      const bothSynced = writer.synced && observer.synced
      appendParagraph(writer.ydoc, marker)
      const seen = () => observer.ydoc.getXmlFragment('default').toString().includes(marker)
      const deadline = Date.now() + 3_000
      while (!seen() && Date.now() < deadline) await sleep(50)
      const arrived = seen()
      writer.provider.destroy()
      observer.provider.destroy()
      return { bothSynced, arrived }
    }

    const wsLocked = await createDocument('ws-locked', { content: titleDoc('WS locked') })
    await prisma.documentMetadata.update({
      where: { documentId: wsLocked.documentId },
      data: { readOnly: true }
    })
    const wsOpen = await createDocument('ws-open', { content: titleDoc('WS open') })

    const lockedRun = await relays(wsLocked.documentId, wsLocked.slug, `${PREFIX}-locked-edit`)
    check(lockedRun.bothSynced, 'two anonymous collaborators synced on the read-only document')
    check(
      lockedRun.bothSynced && !lockedRun.arrived,
      'an anonymous edit on a read-only document never reaches the other client'
    )
    const openRun = await relays(wsOpen.documentId, wsOpen.slug, `${PREFIX}-open-edit`)
    check(openRun.bothSynced, 'two anonymous collaborators synced on the unlocked document')
    check(
      openRun.arrived,
      'control: the same edit on an unlocked document reaches the other client'
    )

    const wsPrivate = await createDocument('ws-private', { content: titleDoc('WS private') })
    await prisma.documentMetadata.update({
      where: { documentId: wsPrivate.documentId },
      data: { isPrivate: true }
    })
    const outsider = await openProvider(wsPrivate.documentId, wsPrivate.slug)
    check(
      outsider.authFailed,
      'an anonymous socket on a Private document gets authenticationFailed'
    )
    check(!outsider.synced, 'the refused socket never synced the Private document')
    outsider.provider.destroy()

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
    const metricValue = async (series: string) => {
      const body = await (await fetch(`http://127.0.0.1:${internalPort}/metrics`)).text()
      const line = body.split('\n').find((row) => row.startsWith(`${series} `))
      return line ? Number(line.split(' ').pop()) : 0
    }
    const droppedTotal = (reason: string) =>
      metricValue(`stateless_relay_dropped_total{reason="${reason}"}`)
    const awarenessDroppedTotal = () => metricValue('ws_awareness_frames_dropped_total')

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

    // The webapp reads `msg` before `type`, so a type-only allowlist still passes a
    // forged save confirmation. The guard therefore refuses any `msg` it did not name.
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

    // Awareness frame-size budget. The field is set in the constructor's tick, so the
    // first awareness frame carries it; a normal join would first send an empty state.
    const peerAwareness = victim.provider.awareness
    let oversizedClientId = -1
    let peerSawOversized = false
    const watchOversized = () => {
      if (peerAwareness.getStates().has(oversizedClientId)) peerSawOversized = true
    }
    peerAwareness.on('change', watchOversized)
    let framesDropped = await awarenessDroppedTotal()
    const oversized = new HocuspocusProvider({
      url: `ws://127.0.0.1:${wsPort}`,
      name: doc.documentId,
      document: new Y.Doc(),
      token: JSON.stringify({ slug: doc.slug, deviceType: 'desktop' }),
      WebSocketPolyfill: WebSocket
    })
    oversized.setAwarenessField('blob', 'x'.repeat(70_000))
    oversizedClientId = oversized.document.clientID
    const refusedBy = Date.now() + 5_000
    while ((await awarenessDroppedTotal()) === framesDropped && Date.now() < refusedBy) {
      watchOversized()
      await sleep(50)
    }
    // Destroyed at once, so a reconnect cannot send the frame again.
    oversized.destroy()
    check(
      (await awarenessDroppedTotal()) >= framesDropped + 1,
      'an awareness frame over the size budget was refused'
    )
    await sleep(500)
    watchOversized()
    peerAwareness.off('change', watchOversized)
    check(!peerSawOversized, 'the refused awareness state never reached the other client')

    // Positive control AFTER the negative: a normal field, then a large but legal one.
    // The other client, a 3.x provider, sends the large state back, so that frame counts too.
    framesDropped = await awarenessDroppedTotal()
    const control = await openProvider(doc.documentId, doc.slug)
    const controlClientId = control.ydoc.clientID
    const peerState = () => peerAwareness.getStates().get(controlClientId)
    const waitForState = async (accept: (state: any) => boolean) => {
      const stateBy = Date.now() + 5_000
      while (!accept(peerState()) && Date.now() < stateBy) await sleep(50)
      return accept(peerState())
    }
    control.provider.setAwarenessField('user', { name: 'control' })
    check(
      await waitForState((state) => state?.user?.name === 'control'),
      'a normal awareness field reaches the other client'
    )
    control.provider.setAwarenessField('blob', 'y'.repeat(23_000))
    check(
      await waitForState((state) => state?.blob?.length === 23_000),
      'a 23 KB awareness field reaches the other client'
    )
    await sleep(500)
    check(
      (await awarenessDroppedTotal()) === framesDropped,
      'no awareness frame was refused under the budget'
    )
    control.provider.destroy()

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
  check(false, 'the run completed')
} finally {
  await StoreDocumentQueue.resume().catch(() => {})
  await deleteTestUser(actor, SERVICE_KEY)
  await cleanup()
  killServers()
  await worker.close()
  await closeQueues()
  await prisma.$disconnect()
  await disconnectRedis()
}

const { failed, skipped } = outcome()
if (skipped > 0) console.log(`\n${skipped} check group(s) skipped`)
console.log(`\nversions E2E: ${failed ? 'FAILED' : skipped > 0 ? 'SKIPPED' : 'PASSED'}`)
process.exit(failed ? 1 : 0)
