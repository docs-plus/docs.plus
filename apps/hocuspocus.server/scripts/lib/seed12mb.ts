/**
 * Deterministic ~12.5 MB Yjs snapshot seed (#738) for benchmarks and soak runs.
 * Builds a TitleDocument (`heading` + 400 paragraphs) under `default` plus live
 * `@tiptap/y-tiptap` 3.0.10 position-migration records across 56 client IDs.
 */
import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { migrationExtensions } from '../../src/lib/migration-extensions'
import { POSITION_MIGRATIONS_PREFIX } from '../../src/lib/snapshotMetadata'
import { mulberry32, paragraph, PARAGRAPH_CHARS } from './benchFixture'

/** Target encoded Yjs update size (~12.5 MB, matching the #737/#738 soak corpus). */
export const SEED_12MB_TARGET_BYTES = 12_550_000

const PRNG_SEED = 738
const BASE_CLIENT_ID = 738_000_000
const MIGRATION_CLIENTS = 56
const PARAGRAPH_COUNT = 400
const BASE_ENTRIES_PER_CLIENT = 42
const TRANSFERS_PER_ENTRY = 40
const MIGRATION_MAP_KEY = `${POSITION_MIGRATIONS_PREFIX}root:default`

const WORDS = (
  'the document section heading change review editor version history people write share ' +
  'team plan notes meeting project draft update chat reply link table list quote code'
).split(' ')

export interface Seed12MbResult {
  update: Uint8Array
  sha256: string
  byteLength: number
  migrationEntries: number
}

const deterministicSentence = (rand: () => number, chars: number): string => {
  let out = ''
  while (out.length < chars) out += `${WORDS[Math.floor(rand() * WORDS.length)]} `
  return out.trim()
}

const buildTitleDocumentJson = (rand: () => number): Record<string, unknown> => {
  const content: object[] = [
    {
      type: 'heading',
      attrs: { level: 1, 'toc-id': 'toc-seed-0001' },
      content: [{ type: 'text', text: 'Seed 12 MB document' }]
    }
  ]

  for (let i = 0; i < PARAGRAPH_COUNT; i++) {
    content.push(paragraph(deterministicSentence(rand, PARAGRAPH_CHARS)))
  }

  return { type: 'doc', content }
}

const makeMigrationRecord = (
  client: number,
  clock: number,
  seen: [number, number][],
  rand: () => number,
  transferCount: number
) => {
  const transfers: Array<{
    source: { client: number; clock: number; length: number }
    target: {
      client: number
      clock: number
      type: { client: number; clock: number }
      assoc: number
    }
  }> = []

  for (let i = 0; i < transferCount; i++) {
    const srcClient = BASE_CLIENT_ID + Math.floor(rand() * MIGRATION_CLIENTS)
    const dstClient = BASE_CLIENT_ID + Math.floor(rand() * MIGRATION_CLIENTS)
    const srcClock = Math.floor(rand() * 100_000)
    const dstClock = srcClock + 1 + Math.floor(rand() * 200)
    const typeClock = Math.floor(rand() * 50_000)

    transfers.push({
      source: { client: srcClient, clock: srcClock, length: 1 + Math.floor(rand() * 32) },
      target: {
        client: dstClient,
        clock: dstClock,
        type: { client: BASE_CLIENT_ID, clock: typeClock },
        assoc: i % 2 === 0 ? 0 : -1
      }
    })
  }

  return {
    version: 1,
    client,
    clock,
    seen,
    transfers
  }
}

/**
 * Generates a deterministic ~12.5 MB Yjs update carrying live `\x09transfers`
 * entries under `__tiptap_position_migrations:root:default` across 56 clients.
 */
export function buildSeed12Mb(): Seed12MbResult {
  const rand = mulberry32(PRNG_SEED)
  const pmDoc = buildTitleDocumentJson(rand)
  const source = TiptapTransformer.toYdoc(pmDoc, 'default', migrationExtensions)
  const ydoc = new Y.Doc()

  try {
    ydoc.clientID = BASE_CLIENT_ID
    const nodes = source.getXmlFragment('default').toArray() as Y.XmlElement[]
    ydoc.getXmlFragment('default').insert(
      0,
      nodes.map((node) => node.clone())
    )

    const migrationMap = ydoc.getMap<ReturnType<typeof makeMigrationRecord>>(MIGRATION_MAP_KEY)
    const clocks = new Map<number, number>()
    clocks.set(BASE_CLIENT_ID, Y.getState(ydoc.store, BASE_CLIENT_ID))

    const appendEntriesForClient = (
      clientIdx: number,
      count: number,
      transfersPerEntry: number
    ) => {
      const clientId = BASE_CLIENT_ID + clientIdx
      ydoc.clientID = clientId
      ydoc.transact(() => {
        for (let i = 0; i < count; i++) {
          const clock = Y.getState(ydoc.store, clientId)
          clocks.set(clientId, clock)
          const seen: [number, number][] = [...clocks.entries()]
          migrationMap.set(
            `${clientId}:${clock}`,
            makeMigrationRecord(clientId, clock, seen, rand, transfersPerEntry)
          )
        }
      })
    }

    let migrationEntries = 0
    for (let round = 0; round < BASE_ENTRIES_PER_CLIENT; round++) {
      for (let c = 0; c < MIGRATION_CLIENTS; c++) {
        appendEntriesForClient(c, 1, TRANSFERS_PER_ENTRY)
        migrationEntries += 1
      }
    }

    // Calibrate cleanly to SEED_12MB_TARGET_BYTES (~12.55 MB) with deterministic top-up entries.
    let update = Y.encodeStateAsUpdate(ydoc)
    let topUpIndex = 0
    while (update.byteLength < SEED_12MB_TARGET_BYTES) {
      const remaining = SEED_12MB_TARGET_BYTES - update.byteLength
      const bytesPerEntry = Math.max(
        1,
        Math.floor(update.byteLength / Math.max(migrationEntries, 1))
      )
      const entriesNeeded = Math.max(1, Math.floor(remaining / bytesPerEntry))
      for (let i = 0; i < entriesNeeded; i++) {
        appendEntriesForClient(topUpIndex % MIGRATION_CLIENTS, 1, TRANSFERS_PER_ENTRY)
        topUpIndex += 1
        migrationEntries += 1
      }
      update = Y.encodeStateAsUpdate(ydoc)
    }

    const sha256 = new Bun.CryptoHasher('sha256').update(update).digest('hex')
    return {
      update,
      sha256,
      byteLength: update.byteLength,
      migrationEntries
    }
  } finally {
    source.destroy()
    ydoc.destroy()
  }
}
