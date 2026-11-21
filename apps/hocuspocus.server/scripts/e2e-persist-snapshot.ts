/**
 * Real-Postgres E2E for `persistSnapshot` and the document store lock (#704).
 * Needs Postgres only. Run from apps/hocuspocus.server:
 * bun --env-file=../../.env.local scripts/e2e-persist-snapshot.ts
 * Races are made deterministic with a lock holder or a writer injected mid-transaction.
 */
import * as Y from 'yjs'

import { resolveClientAuthors } from '../src/lib/client-authors'
import { lockDocumentStore } from '../src/lib/lockDocumentStore'
import { persistSnapshot, type PersistSnapshotInput } from '../src/lib/persistSnapshot'
import { prisma } from '../src/lib/prisma'
import { stripSnapshotMetadata } from '../src/lib/snapshotMetadata'
import { appendBackupRow } from '../src/modules/document-versions/infra/versionsStore'
import { createTally, pollFor } from './lib/e2eHarness'

const PREFIX = `e2e-persist-${Date.now()}`
const { check, outcome } = createTally()

let docCount = 0
const newDocument = async (): Promise<string> => {
  docCount += 1
  const documentId = `${PREFIX}-${docCount}`
  await prisma.documentMetadata.create({ data: { documentId, slug: documentId, title: 'e2e' } })
  return documentId
}

// One live room per test. A fixed clientID per editor makes the author check exact.
const editor = (doc: Y.Doc, clientID: number) => {
  const view = new Y.Doc()
  view.clientID = clientID
  Y.applyUpdate(view, Y.encodeStateAsUpdate(doc))
  return {
    view,
    sync: () => Y.applyUpdate(doc, Y.encodeStateAsUpdate(view, Y.encodeStateVector(doc)))
  }
}

const stateOf = (doc: Y.Doc) => Y.encodeStateAsUpdate(doc)

const save = (
  documentId: string,
  incoming: Uint8Array,
  extra: Partial<PersistSnapshotInput> = {}
) =>
  persistSnapshot(prisma, {
    documentId,
    incoming,
    commitMessage: '',
    trigger: 'websocket',
    triggeredBy: null,
    contributors: [],
    forced: false,
    skipUnchanged: true,
    ...extra
  })

const head = (documentId: string) =>
  prisma.documents.findFirst({ where: { documentId }, orderBy: { version: 'desc' } })
const rowCount = (documentId: string) => prisma.documents.count({ where: { documentId } })

// A room with two rows, so the head is not the document's first row.
const seededRoom = async (text = 'hello') => {
  const documentId = await newDocument()
  const doc = new Y.Doc()
  doc.clientID = 1
  doc.getText('t').insert(0, text)
  await save(documentId, stateOf(doc))
  doc.getText('t').insert(text.length, '!')
  await save(documentId, stateOf(doc))
  return { documentId, doc }
}

// Holds the store lock and the head row, as an in-flight writer does, until released.
const holdStore = async (documentId: string) => {
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  let held!: () => void
  const ready = new Promise<void>((resolve) => (held = resolve))
  const done = prisma.$transaction(
    async (tx) => {
      await lockDocumentStore(tx, documentId)
      await tx.$queryRaw`
        SELECT id FROM "Documents" WHERE "documentId" = ${documentId}
        ORDER BY version DESC LIMIT 1 FOR UPDATE`
      held()
      await released
    },
    { timeout: 30_000 }
  )
  await ready
  return { release, done }
}

const waitingLocks = () =>
  pollFor(
    async () =>
      Number(
        (
          await prisma.$queryRaw<
            { n: bigint }[]
          >`SELECT count(*) AS n FROM pg_locks WHERE NOT granted`
        )[0]?.n ?? 0
      ),
    (n) => n >= 2,
    5000
  )

// A client whose `$transaction` runs `beforeGuard` once, just before the kept-head
// UPDATE, on another connection. That is a writer that skips the store lock.
const injectBeforeGuard = (times: number, beforeGuard: () => Promise<void>) => {
  let left = times
  return {
    $transaction: ((fn: (tx: never) => Promise<unknown>, options: never) =>
      prisma.$transaction(
        (tx) =>
          fn(
            new Proxy(tx, {
              get(target, prop, receiver) {
                const value = Reflect.get(target, prop, receiver)
                if (prop !== '$executeRaw') return value
                return async (sql: TemplateStringsArray, ...values: unknown[]) => {
                  if (left > 0 && sql.join('').includes('UPDATE "Documents" SET contributors')) {
                    left -= 1
                    await beforeGuard()
                  }
                  return value.call(target, sql, ...values)
                }
              }
            }) as never
          ),
        options
      )) as unknown as typeof prisma.$transaction
  }
}

// A row written outside the lock: the current head merged with one more edit.
const insertOutsideLock = async (documentId: string, text: string) => {
  const current = await head(documentId)
  if (!current) throw new Error('no head to extend')
  const extra = new Y.Doc()
  extra.clientID = 900 + current.version
  extra.getText('other').insert(0, text)
  await prisma.documents.create({
    data: {
      documentId,
      version: current.version + 1,
      data: stripSnapshotMetadata(Y.mergeUpdates([new Uint8Array(current.data), stateOf(extra)])),
      commitMessage: '',
      trigger: 'websocket',
      contributors: ['dave']
    }
  })
}

async function cleanup() {
  await prisma.documentMetadata.deleteMany({ where: { documentId: { startsWith: PREFIX } } })
}

console.log('E2E: persistSnapshot (real Postgres)')

try {
  // [1] A twin flush keeps the head and merges its contributors without duplicates.
  {
    const { documentId, doc } = await seededRoom()
    await prisma.documents.updateMany({
      where: { documentId, version: 2 },
      data: { contributors: ['alice', 'bob'] }
    })
    const before = await rowCount(documentId)
    const twin = await save(documentId, stateOf(doc), { contributors: ['bob', 'carol', 'alice'] })
    const row = await head(documentId)
    check(twin.outcome === 'unchanged' && twin.version === 2, '[1] twin flush keeps head v2')
    check((await rowCount(documentId)) === before, '[1] twin flush adds no row')
    check(
      JSON.stringify(row?.contributors) === JSON.stringify(['alice', 'bob', 'carol']),
      `[1] head contributors are a first-seen union with no duplicates (${row?.contributors})`
    )
  }

  // [2] A deleted and retyped letter keeps the text but moves the block's author.
  {
    const { documentId, doc } = await seededRoom()
    await prisma.documentClientAuthor.createMany({
      data: [
        { documentId, clientId: 1n, userId: 'alice' },
        { documentId, clientId: 2n, userId: 'bob' }
      ]
    })
    const headBefore = await head(documentId)
    const unchanged = await save(documentId, stateOf(doc))
    const headKept = await head(documentId)
    check(
      unchanged.outcome === 'unchanged' &&
        !!headBefore &&
        !!headKept &&
        Buffer.from(headKept.data).equals(Buffer.from(headBefore.data)),
      '[2] a kept head keeps its bytes, so its per-block authors stay'
    )

    const bob = editor(doc, 2)
    const text = bob.view.getText('t')
    const last = text.length - 1
    const letter = text.toString()[last]
    text.delete(last, 1)
    text.insert(last, letter)
    bob.sync()
    const retyped = await save(documentId, stateOf(doc), { contributors: ['bob'] })
    check(retyped.outcome === 'inserted', '[2] same text, new author: the save inserts a row')
    const row = await head(documentId)
    const stored = new Y.Doc()
    if (row) Y.applyUpdate(stored, new Uint8Array(row.data))
    // The last visible letter's struct. Its clientID names who typed it.
    type TextItem = { id: { client: number }; deleted: boolean; right: TextItem | null }
    let lastItem: TextItem | null = null
    let item = (stored.getText('t') as unknown as { _start: TextItem | null })._start
    for (; item; item = item.right) {
      if (!item.deleted) lastItem = item
    }
    const authors = lastItem
      ? await resolveClientAuthors(prisma, documentId, [lastItem.id.client])
      : []
    check(
      stored.getText('t').toString() === 'hello!' && authors[0]?.userId === 'bob',
      `[2] the retyped letter's author resolves to bob (got ${authors[0]?.userId})`
    )
  }

  // [3] Named, forced and non-websocket saves always insert, even with equal bytes.
  {
    const { documentId, doc } = await seededRoom()
    const cases: [string, Partial<PersistSnapshotInput>][] = [
      ['named websocket', { commitMessage: 'My checkpoint' }],
      ['forced websocket', { forced: true }],
      ['api', { trigger: 'api' }],
      ['mcp', { trigger: 'mcp' }],
      ['checkpoint', { trigger: 'checkpoint', commitMessage: 'cp' }],
      ['revert', { trigger: 'revert', commitMessage: 'Restored version 1' }],
      ['revert-backup', { trigger: 'revert-backup', commitMessage: 'Before restore' }],
      ['schema-migration', { trigger: 'schema-migration', commitMessage: 'Schema migration' }],
      ['flag off', { skipUnchanged: false }]
    ]
    for (const [label, extra] of cases) {
      const before = await rowCount(documentId)
      // An unnamed websocket head first, so only the case itself can refuse the skip.
      await prisma.documents.updateMany({
        where: { documentId },
        data: { commitMessage: '', trigger: 'websocket' }
      })
      const result = await save(documentId, stateOf(doc), extra)
      check(
        result.outcome === 'inserted' && (await rowCount(documentId)) === before + 1,
        `[3] ${label} save inserts a row`
      )
    }
    // Nothing skips into a named or a machine head, or onto a first row.
    await prisma.documents.updateMany({
      where: { documentId },
      data: { commitMessage: 'Restored version 1', trigger: 'revert' }
    })
    check(
      (await save(documentId, stateOf(doc))).outcome === 'inserted',
      '[3] no skip onto a named head'
    )
    const first = await newDocument()
    await save(first, stateOf(doc))
    check(
      (await save(first, stateOf(doc))).outcome === 'inserted',
      '[3] no skip onto the first row'
    )
  }

  // [4] A writer that skips the lock lands between the head read and the guard. The
  // guard must miss, and the rerun must credit the skipped save on the NEW head.
  {
    const { documentId, doc } = await seededRoom()
    const racy = injectBeforeGuard(1, () => insertOutsideLock(documentId, 'outside'))
    const result = await persistSnapshot(racy, {
      documentId,
      incoming: stateOf(doc),
      commitMessage: '',
      trigger: 'websocket',
      triggeredBy: 'erin',
      contributors: ['erin'],
      forced: false,
      skipUnchanged: true
    })
    const row = await head(documentId)
    check(
      result.outcome === 'unchanged' && result.version === 3 && row?.version === 3,
      `[4] the rerun keeps the moved head v3 (got ${result.outcome} v${result.version})`
    )
    check(
      !!row?.contributors.includes('erin'),
      `[4] the moved head carries the skipped save's contributor (got ${row?.contributors})`
    )
  }

  // [5] The head moves on the rerun too: insert as today, counted as head-moved.
  {
    const { documentId, doc } = await seededRoom()
    let n = 0
    const racy = injectBeforeGuard(2, () => insertOutsideLock(documentId, `outside-${++n}`))
    const result = await persistSnapshot(racy, {
      documentId,
      incoming: stateOf(doc),
      commitMessage: '',
      trigger: 'websocket',
      triggeredBy: 'erin',
      contributors: ['erin'],
      forced: false,
      skipUnchanged: true
    })
    const row = await head(documentId)
    const stored = new Y.Doc()
    if (row) Y.applyUpdate(stored, new Uint8Array(row.data))
    check(
      result.outcome === 'head-moved' && row?.version === 5 && result.version === 5,
      `[5] a second guard miss inserts v5 as head-moved (got ${result.outcome} v${result.version})`
    )
    check(
      stored.getText('t').toString() === 'hello!' && !!row?.contributors.includes('erin'),
      '[5] the inserted row keeps the text and its contributor'
    )
  }

  // [6] A revert-backup append races a worker save. Both rows land, first try each.
  {
    const { documentId, doc } = await seededRoom()
    const versionBefore = (await head(documentId))?.version ?? 0
    const holder = await holdStore(documentId)

    doc.getText('t').insert(0, 'live ')
    const workerSave = save(documentId, stateOf(doc), { contributors: ['alice'] }).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error })
    )
    const backupDoc = new Y.Doc()
    backupDoc.clientID = 7
    backupDoc.getText('backup').insert(0, 'pre-restore')
    let backupTransactions = 0
    const counting = {
      $transaction: ((...args: Parameters<typeof prisma.$transaction>) => {
        backupTransactions += 1
        return (prisma.$transaction as (...a: unknown[]) => Promise<unknown>)(...args)
      }) as typeof prisma.$transaction
    } as typeof prisma
    const backup = appendBackupRow(counting, {
      documentId,
      snapshot: stripSnapshotMetadata(stateOf(backupDoc)),
      name: 'Before restore',
      triggeredBy: 'alice',
      contributors: ['alice']
    })

    const waiting = await waitingLocks()
    check((waiting ?? 0) >= 2, `[6] both writers wait behind the holder (${waiting})`)
    holder.release()
    await holder.done
    const [worker, appended] = await Promise.all([workerSave, backup])
    const rows = await prisma.documents.findMany({
      where: { documentId, version: { gt: versionBefore } },
      orderBy: { version: 'asc' }
    })
    check(worker.ok, `[6] the worker save did not throw (${worker.ok ? '' : String(worker.error)})`)
    check(
      appended.ok && backupTransactions === 1,
      `[6] the backup landed on its first try (${backupTransactions} tries)`
    )
    check(rows.length === 2, `[6] both rows landed (${rows.length})`)
    const last = new Y.Doc()
    if (rows[1]) Y.applyUpdate(last, new Uint8Array(rows[1].data))
    check(
      last.getText('t').toString() === 'live hello!' &&
        last.getText('backup').toString() === 'pre-restore',
      '[6] the newer row holds both writes'
    )
  }
} finally {
  await cleanup()
  await prisma.$disconnect()
}

const { failed } = outcome()
console.log(failed ? '\npersistSnapshot E2E: FAILED' : '\npersistSnapshot E2E: PASSED')
process.exit(failed ? 1 : 0)
