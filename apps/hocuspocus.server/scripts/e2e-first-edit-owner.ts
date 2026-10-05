/**
 * Real-infra E2E for first-edit ownership: a signed-in first edit that creates the
 * row owns it and tells the room live; a signed-out one, or a cede, owns nothing.
 * Needs Postgres and Redis. Without live Supabase Auth only the signed-out case runs.
 * `cd apps/hocuspocus.server && bun --env-file=../../.env.local scripts/e2e-first-edit-owner.ts`
 */
import * as Y from 'yjs'

import { prisma } from '../src/lib/prisma'
import { closeQueues, createDocumentWorker } from '../src/lib/queue'
import { disconnectRedis } from '../src/lib/redis'
import {
  createTally,
  deleteTestUser,
  makeOpenProvider,
  makeRest,
  mintTestUser,
  pollFor,
  sleep,
  spawnServers,
  type TestUser,
  waitForHttp
} from './lib/e2eHarness'

const PREFIX = `e2e-owner-${Date.now()}`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for the first-edit owner E2E')
  process.exit(1)
}

const { check, skip, outcome } = createTally()
const servers = spawnServers()
const rest = makeRest(servers.restUrl, SERVICE_KEY)
const openProvider = makeOpenProvider(servers.wsPort)
const createdDocumentIds: string[] = []

// The id a reload resolves for a never-persisted slug: the derived draft id.
const draftId = async (slug: string): Promise<string> => {
  const response = await rest(`/api/documents/${slug}`, { auth: null })
  const documentId = response.body?.data?.documentId
  if (typeof documentId !== 'string') throw new Error(`No draft id for ${slug}`)
  createdDocumentIds.push(documentId)
  return documentId
}

// Opened before the edit, so a missed live event cannot hide behind a late join.
const openWatcher = async (documentId: string, slug: string) => {
  const opened = await openProvider(documentId, slug, '')
  const owners: unknown[] = []
  opened.provider.on('stateless', ({ payload }: { payload: string }) => {
    const data = JSON.parse(payload)
    if (data.type === 'owner') owners.push(data.ownerId)
  })
  return { ...opened, owners }
}

const firstEdit = (ydoc: Y.Doc, text: string) => {
  ydoc.transact(() => {
    ydoc.getMap('metadata').set('isDraft', false)
    const heading = new Y.XmlElement('heading')
    heading.setAttribute('level', '1')
    heading.insert(0, [new Y.XmlText(text)])
    ydoc.getXmlFragment('default').push([heading])
  })
}

const readOwner = (where: { slug: string } | { documentId: string }) =>
  prisma.documentMetadata.findFirst({ where, select: { ownerId: true, email: true } })

// The anchor writes inside onChange, so the row lands well before any persist.
const editAndReadRow = async (
  slug: string,
  accessToken: string,
  opts: { preinsert?: boolean } = {}
) => {
  const documentId = await draftId(slug)
  if (opts.preinsert) {
    await prisma.documentMetadata.create({
      data: { documentId, slug, title: slug, description: slug, keywords: '' }
    })
  }
  const watcher = await openWatcher(documentId, slug)
  const editor = await openProvider(documentId, slug, accessToken)
  check(watcher.synced && editor.synced, 'watcher and editor synced against the real WS server')

  firstEdit(editor.ydoc, `${slug} title`)
  await pollFor(
    () => readOwner({ slug }),
    () => true,
    10_000
  )
  // Room for a late write or broadcast, so "null" and "exactly one" mean something.
  // A pre-inserted row is found at once, so the read waits too.
  await sleep(1500)
  const row = await readOwner({ slug })
  editor.provider.destroy()
  watcher.provider.destroy()

  // The last disconnect flushes at once. Waiting for that save keeps cleanup from
  // racing a late job, and proves the first persist never moves the owner.
  const saved = await pollFor(
    () => prisma.documents.findFirst({ where: { documentId }, select: { id: true } }),
    () => true
  )
  check(saved !== null, 'the first persist landed')
  const after = await readOwner({ slug })
  check(after?.ownerId === row?.ownerId, 'the first persist kept the ownerId the anchor wrote')
  return { row, owners: watcher.owners }
}

console.log('E2E: first-edit ownership (real REST + WS + Redis + Postgres + Supabase)')

const worker = createDocumentWorker()
await worker.waitUntilReady()

let user: TestUser | null = null
try {
  if (!(await waitForHttp(`http://127.0.0.1:${servers.internalPort}/metrics`))) {
    throw new Error('WS process internal listener never came up')
  }
  if (!(await waitForHttp(`${servers.restUrl}/health`))) {
    throw new Error('REST process never came up')
  }

  // Needs no Supabase, so CI runs it even where Auth is a closed port.
  console.log('\n[B] a signed-out first edit leaves the document open')
  {
    const { row, owners } = await editAndReadRow(`${PREFIX}-signed-out`, '')
    check(row !== null, 'the anchor created the row')
    check(row?.ownerId === null, `ownerId stays null (got ${row?.ownerId})`)
    check(owners.length === 0, `no owner event (got ${JSON.stringify(owners)})`)
  }

  user = await mintTestUser(PREFIX, SERVICE_KEY, 'First Edit Owner')
  if (!user) {
    skip('no live Supabase Auth, so no verifiable signed-in socket; cases A, C and D skipped')
  } else {
    console.log('\n[A] a signed-in first edit creates the row and owns it')
    {
      const { row, owners } = await editAndReadRow(`${PREFIX}-signed-in`, user.accessToken)
      check(row?.ownerId === user.id, `ownerId is the editor (got ${row?.ownerId})`)
      check(row?.email === user.email, `email is the editor's (got ${row?.email})`)
      check(
        owners.length === 1 && owners[0] === user.id,
        `the watcher got exactly one owner event naming the editor (got ${JSON.stringify(owners)})`
      )
    }

    console.log('\n[C] a signed-in edit on an existing ownerless row never claims it')
    {
      const { row, owners } = await editAndReadRow(`${PREFIX}-cede`, user.accessToken, {
        preinsert: true
      })
      check(row?.ownerId === null, `ownerId stays null (got ${row?.ownerId})`)
      check(owners.length === 0, `no owner event on a cede (got ${JSON.stringify(owners)})`)
    }

    console.log('\n[D] the worker backstop owns a row the anchor never wrote')
    {
      // A slugless token makes the anchor return before any write, so only the
      // worker's first-save CREATE can make this row.
      const documentId = `${PREFIX}-backstop`
      createdDocumentIds.push(documentId)
      const editor = await openProvider(documentId, '', user.accessToken)
      check(editor.synced, 'slugless editor synced')
      firstEdit(editor.ydoc, 'backstop title')
      await sleep(1000)
      check(
        (await readOwner({ documentId })) === null,
        'the anchor wrote nothing for a slugless edit'
      )
      // The last disconnect flushes at once, so no debounce wait.
      editor.provider.destroy()
      const row = await pollFor(
        () => readOwner({ documentId }),
        () => true
      )
      check(row !== null, 'the worker created the row on the first save')
      check(row?.ownerId === user.id, `ownerId is the live editor (got ${row?.ownerId})`)
    }
  }
} catch (error) {
  console.error('\nE2E aborted:', error)
  check(false, 'the run completed')
} finally {
  await prisma.documentMetadata.deleteMany({
    where: {
      OR: [{ slug: { startsWith: PREFIX } }, { documentId: { in: createdDocumentIds } }]
    }
  })
  await deleteTestUser(user, SERVICE_KEY)
  servers.kill()
  await worker.close()
  await closeQueues()
  await prisma.$disconnect()
  await disconnectRedis()
}

const { failed, skipped } = outcome()
console.log(`\nfirst-edit owner E2E: ${failed ? 'FAILED' : skipped ? 'SKIPPED' : 'PASSED'}`)
process.exit(failed ? 1 : 0)
