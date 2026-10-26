/**
 * Real-infra E2E for the Document Content API. The path is REST → the WS
 * process's internal listener → openDirectConnection → transact → BullMQ worker →
 * Postgres. A real collaboration client watches.
 *
 * Run as a standalone process, NOT `bun test`. BullMQ's worker run-loop does not
 * progress under the bun test runner. It works in a normal process, as in prod.
 * Needs the `make dev-local` docker services (Postgres + Redis) and root .env.local.
 */
import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { prisma } from '../src/lib/prisma'
import { closeQueues, createDocumentWorker } from '../src/lib/queue'
import { disconnectRedis } from '../src/lib/redis'
import {
  createTally,
  makeDocumentFixtures,
  makeOpenProvider,
  makeRest,
  paragraphDoc,
  pollFor,
  sleep,
  spawnServers,
  titleDoc,
  waitForHttp
} from './lib/e2eHarness'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const { check, outcome } = createTally()

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for the content-inject E2E')
  process.exit(1)
}

const servers = spawnServers()
const rest = makeRest(servers.restUrl, SERVICE_KEY)
const { prefix: PREFIX, createDocument, cleanup } = makeDocumentFixtures(rest, prisma, 'e2e-inject')
const openProvider = makeOpenProvider(servers.wsPort)

const headRow = (documentId: string) =>
  prisma.documents.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' },
    select: { version: true, data: true }
  })

const decodeRow = (data: Uint8Array) => {
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, new Uint8Array(data))
  return {
    json: TiptapTransformer.fromYdoc(ydoc, 'default') as { content: Record<string, any>[] },
    metadata: ydoc.getMap('metadata').toJSON() as Record<string, unknown>
  }
}

const fragmentText = (ydoc: Y.Doc): string => {
  const json = TiptapTransformer.fromYdoc(ydoc, 'default') as { content?: Record<string, any>[] }
  return JSON.stringify(json?.content ?? [])
}

console.log('E2E: document content injection (real REST + WS + Redis + Postgres)')
await cleanup()

const worker = createDocumentWorker()
await worker.waitUntilReady()

if (!(await waitForHttp(`http://127.0.0.1:${servers.internalPort}/metrics`))) {
  console.error('WS process internal listener never came up')
  servers.kill()
  process.exit(1)
}
if (!(await waitForHttp(`${servers.restUrl}/health`))) {
  console.error('REST process never came up')
  servers.kill()
  process.exit(1)
}

try {
  // 1. Live append reaches an open collaborator and then the database.
  console.log('\n[1] live append with a connected collaborator')
  {
    const doc = await createDocument('live', { content: titleDoc('Live doc') })
    const { provider, ydoc, synced } = await openProvider(doc.documentId, doc.slug, '')
    check(synced, 'collaboration provider synced against the real WS server')

    const patch = await rest(`/api/documents/${doc.documentId}/content?mode=append`, {
      method: 'PATCH',
      body: JSON.stringify({ content: paragraphDoc('appended-live') })
    })
    check(patch.status === 200, `PATCH append returned 200 (got ${patch.status})`)

    const deadline = Date.now() + 2000
    while (!fragmentText(ydoc).includes('appended-live') && Date.now() < deadline) await sleep(50)
    check(
      fragmentText(ydoc).includes('appended-live'),
      'the open collaborator saw the appended paragraph within 2s, without reconnecting'
    )

    const row = await pollFor(
      () => headRow(doc.documentId),
      (r) => decodeRow(r.data).json.content.length === 2
    )
    check(!!row, 'the append persisted through the normal store pipeline')
    provider.destroy()

    const fresh = await openProvider(doc.documentId, doc.slug, '')
    check(
      fragmentText(fresh.ydoc).includes('appended-live'),
      'a fresh collaborator loads the appended paragraph'
    )
    fresh.provider.destroy()
  }

  // 2. Cold replace into a metadata-only document, with the metadata invariant.
  console.log('\n[2] cold replace into a metadata-only document')
  {
    const doc = await createDocument('cold')
    check((await headRow(doc.documentId)) === null, 'the document starts with zero snapshot rows')

    const patch = await rest(`/api/documents/${doc.documentId}/content?mode=replace`, {
      method: 'PATCH',
      body: JSON.stringify({ content: titleDoc('Cold replace') })
    })
    check(patch.status === 200, `PATCH replace returned 200 (got ${patch.status})`)

    const row = await pollFor(
      () => headRow(doc.documentId),
      (r) => r.version >= 1
    )
    check(!!row && row.version === 1, 'the worker wrote version 1 through the isFirst path')
    if (row) {
      const { json, metadata } = decodeRow(row.data)
      check(
        json.content.length === 1 && json.content[0].type === 'heading',
        'the stored snapshot round-trips to the injected heading'
      )
      check(
        json.content[0].content[0].text === 'Cold replace',
        'the heading text matches the payload'
      )
      check(
        typeof json.content[0].attrs['toc-id'] === 'string',
        'the server stamped a toc-id on the injected heading'
      )
      // stripSnapshotMetadata removes isDraft but not needsInitialization.
      check(
        metadata.needsInitialization === false,
        'needsInitialization is cleared in the stored snapshot'
      )
    }

    // Regression pin on the already-shipped `update: {}` invariant: only the
    // isFirst path touches metadata, so this setup is what makes it non-vacuous.
    const meta = await prisma.documentMetadata.findUnique({
      where: { documentId: doc.documentId },
      select: { title: true, slug: true }
    })
    check(meta?.title === doc.title, 'the first save left the metadata title untouched')
    check(meta?.slug === doc.slug, 'the first save left the metadata slug untouched')
  }

  // 3. The draft trap: a never-persisted document mints isDraft: true on open.
  console.log('\n[3] draft trap — injection into a live, never-persisted document')
  {
    const doc = await createDocument('draft')
    const { provider, ydoc, synced } = await openProvider(doc.documentId, doc.slug, '')
    check(synced, 'collaborator synced against the draft document')

    const patch = await rest(`/api/documents/${doc.documentId}/content?mode=replace`, {
      method: 'PATCH',
      body: JSON.stringify({ content: titleDoc('Draft rescue') })
    })
    check(patch.status === 200, `PATCH into the draft returned 200 (got ${patch.status})`)

    const deadline = Date.now() + 2000
    while (!fragmentText(ydoc).includes('Draft rescue') && Date.now() < deadline) await sleep(50)
    check(
      fragmentText(ydoc).includes('Draft rescue'),
      'the collaborator saw the injected title live'
    )

    const row = await pollFor(
      () => headRow(doc.documentId),
      (r) => r.version >= 1
    )
    check(!!row, 'clearing isDraft let the store pipeline persist the document')

    // The isDraft flip trips firstEditMetadataExtension → ensureDraftDocumentMetadata,
    // which is a create-only no-op here because the row already exists.
    const metaCount = await prisma.documentMetadata.count({ where: { slug: doc.slug } })
    check(metaCount === 1, 'the first-edit anchor did not duplicate the metadata row')

    provider.destroy()
    const fresh = await openProvider(doc.documentId, doc.slug, '')
    check(
      fragmentText(fresh.ydoc).includes('Draft rescue'),
      'a fresh collaborator loads the injected title'
    )
    fresh.provider.destroy()
  }

  // 4. A wrong bearer is rejected on every content surface and writes nothing.
  console.log('\n[4] wrong bearer')
  {
    const doc = await createDocument('auth')
    const before = await prisma.documents.count({ where: { documentId: doc.documentId } })

    const get = await rest(`/api/documents/${doc.documentId}/content`, { auth: 'not-the-key' })
    check(get.status === 401, `GET with a wrong bearer returned 401 (got ${get.status})`)

    const patch = await rest(`/api/documents/${doc.documentId}/content`, {
      method: 'PATCH',
      auth: 'not-the-key',
      body: JSON.stringify({ content: titleDoc('nope') })
    })
    check(patch.status === 401, `PATCH with a wrong bearer returned 401 (got ${patch.status})`)

    const post = await rest('/api/documents', {
      method: 'POST',
      auth: 'not-the-key',
      body: JSON.stringify({
        title: 'nope',
        slug: `${PREFIX}-auth-denied`,
        content: titleDoc('nope')
      })
    })
    // This is the one content surface on requireServiceRoleOrUser, so a failed
    // service-role compare falls through to user verification. That gives 401 against
    // live Auth or the Supabase stub, and 503 when Auth is unreachable. Both are
    // rejections — the write count below matters.
    check(
      post.status === 401 || post.status === 503,
      `POST with content and a wrong bearer was rejected (got ${post.status})`
    )

    const after = await prisma.documents.count({ where: { documentId: doc.documentId } })
    check(after === before, 'no snapshot rows were written by the rejected calls')
    const denied = await prisma.documentMetadata.count({ where: { slug: `${PREFIX}-auth-denied` } })
    check(denied === 0, 'no metadata row was written by the rejected create')
  }

  // 5. A tombstoned document is invisible to both content routes.
  console.log('\n[5] tombstoned document')
  {
    const doc = await createDocument('tombstone')
    await prisma.documentMetadata.update({
      where: { documentId: doc.documentId },
      data: { deletedAt: new Date() }
    })

    const get = await rest(`/api/documents/${doc.documentId}/content`)
    check(get.status === 404, `GET on a tombstoned document returned 404 (got ${get.status})`)

    const patch = await rest(`/api/documents/${doc.documentId}/content`, {
      method: 'PATCH',
      body: JSON.stringify({ content: titleDoc('nope') })
    })
    check(patch.status === 404, `PATCH on a tombstoned document returned 404 (got ${patch.status})`)

    const rows = await prisma.documents.count({ where: { documentId: doc.documentId } })
    check(rows === 0, 'no snapshot row was written for the tombstoned document')
  }

  // 6. An unreachable WS process degrades to the 503 envelope. Runs last.
  console.log('\n[6] unreachable WS process')
  {
    const doc = await createDocument('unreachable')
    servers.ws.kill()
    await servers.ws.exited
    await sleep(500)

    const patch = await rest(`/api/documents/${doc.documentId}/content`, {
      method: 'PATCH',
      body: JSON.stringify({ content: titleDoc('nope') })
    })
    check(patch.status === 503, `PATCH with the WS process down returned 503 (got ${patch.status})`)
    check(
      patch.body?.error?.code === 'SERVICE_UNAVAILABLE',
      'the 503 carries the canonical SERVICE_UNAVAILABLE envelope'
    )
  }
} catch (error) {
  console.error('\nE2E aborted:', error)
  check(false, 'the run completed')
} finally {
  await cleanup()
  servers.kill()
  await worker.close()
  await closeQueues()
  await prisma.$disconnect()
  await disconnectRedis()
}

const { failed } = outcome()
console.log(failed ? '\ncontent inject E2E: FAILED' : '\ncontent inject E2E: PASSED')
process.exit(failed ? 1 : 0)
