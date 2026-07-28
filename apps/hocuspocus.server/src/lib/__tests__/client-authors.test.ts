import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, test } from 'bun:test'
import * as Y from 'yjs'

import { recordClientAuthors } from '../client-authors'

interface WrittenRow {
  documentId: string
  clientId: bigint
  userId: string
  isAnonymous: boolean
}

const writes: WrittenRow[][] = []
let rejectNextWrite = false

const prisma = {
  documentClientAuthor: {
    createMany: ({ data }: { data: WrittenRow[] }) => {
      writes.push(data)
      return rejectNextWrite ? Promise.reject(new Error('write failed')) : Promise.resolve({})
    }
  }
} as unknown as PrismaClient

const rows = () => writes.flat()

// A room whose owned-client set is whatever the test declares, standing in for
// the awareness membership hocuspocus builds per socket.
const room = (...clientIds: number[]) => ({
  getClients: () => new Set(clientIds),
  getMap: () => ({ get: () => undefined })
})

const draftRoom = (...clientIds: number[]) => ({
  getClients: () => new Set(clientIds),
  getMap: () => ({ get: (key: string) => (key === 'isDraft' ? true : undefined) })
})

const socket = { readyState: 1 }
const origin = { webSocket: socket }

const updateFrom = (clientId: number, text: string): Uint8Array => {
  const ydoc = new Y.Doc()
  ydoc.clientID = clientId
  const captured: Uint8Array[] = []
  ydoc.on('update', (update: Uint8Array) => captured.push(update))
  ydoc.getXmlFragment('default').insert(0, [new Y.XmlText(text)])
  return Y.mergeUpdates(captured)
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  writes.length = 0
  rejectNextWrite = false
})

describe('recordClientAuthors', () => {
  test('binds a clientID the socket owns and authored', () => {
    recordClientAuthors(prisma, {
      document: room(42),
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update: updateFrom(42, 'hello'),
      transactionOrigin: origin
    })

    expect(rows()).toEqual([
      { documentId: 'doc-1', clientId: 42n, userId: 'alice', isAnonymous: false }
    ])
  })

  test('flags an anonymous session and still stores its raw sub', () => {
    recordClientAuthors(prisma, {
      document: room(7),
      documentName: 'doc-1',
      context: { user: { sub: 'ghost-sub', is_anonymous: true } },
      update: updateFrom(7, 'hi'),
      transactionOrigin: origin
    })

    expect(rows()).toEqual([
      { documentId: 'doc-1', clientId: 7n, userId: 'ghost-sub', isAnonymous: true }
    ])
  })

  test('drops a ghost clientID the socket does not own', () => {
    // A relayed or replayed struct: authored by 999, arriving on a socket whose
    // awareness only ever announced 42.
    recordClientAuthors(prisma, {
      document: room(42),
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update: updateFrom(999, 'forged'),
      transactionOrigin: origin
    })

    expect(rows()).toEqual([])
  })

  test('binds only the owned half of a mixed update', () => {
    const mixed = Y.mergeUpdates([updateFrom(42, 'mine'), updateFrom(999, 'theirs')])

    recordClientAuthors(prisma, {
      document: room(42),
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update: mixed,
      transactionOrigin: origin
    })

    expect(rows().map((row) => row.clientId)).toEqual([42n])
  })

  test('writes nothing when ownership or identity cannot be proven', () => {
    const update = updateFrom(42, 'hello')
    const owned = room(42)

    // Redis / DirectConnection origins carry no socket.
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update,
      transactionOrigin: { origin: '__hocuspocus__redis__origin__' } as never
    })
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update,
      transactionOrigin: null
    })
    // No usable sub.
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: { user: { sub: '' } },
      update,
      transactionOrigin: origin
    })
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: null,
      update,
      transactionOrigin: origin
    })
    // Awareness has not announced a client on this socket yet.
    recordClientAuthors(prisma, {
      document: room(),
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update,
      transactionOrigin: origin
    })
    // Undecodable bytes.
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update: new Uint8Array([9, 9, 9, 9]),
      transactionOrigin: origin
    })

    expect(rows()).toEqual([])
  })

  test('skips a draft room, whose metadata row does not exist yet', () => {
    recordClientAuthors(prisma, {
      document: draftRoom(42),
      documentName: 'draft-1',
      context: { user: { sub: 'alice' } },
      update: updateFrom(42, 'hello'),
      transactionOrigin: origin
    })

    expect(rows()).toEqual([])
  })

  test('writes once across a typing burst on the same room', () => {
    const owned = room(42)
    for (let i = 0; i < 500; i += 1) {
      recordClientAuthors(prisma, {
        document: owned,
        documentName: 'doc-1',
        context: { user: { sub: 'alice' } },
        update: updateFrom(42, `keystroke-${i}`),
        transactionOrigin: origin
      })
    }

    expect(writes.length).toBe(1)
    expect(rows().length).toBe(1)
  })

  test('retries after a failed write', async () => {
    const owned = room(42)
    rejectNextWrite = true
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update: updateFrom(42, 'hello'),
      transactionOrigin: origin
    })
    await flush()

    rejectNextWrite = false
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update: updateFrom(42, 'again'),
      transactionOrigin: origin
    })

    expect(writes.length).toBe(2)
  })

  test('keeps the first claim when a second user reuses the clientID', () => {
    const owned = room(42)
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: { user: { sub: 'alice' } },
      update: updateFrom(42, 'hello'),
      transactionOrigin: origin
    })
    recordClientAuthors(prisma, {
      document: owned,
      documentName: 'doc-1',
      context: { user: { sub: 'mallory' } },
      update: updateFrom(42, 'forged'),
      transactionOrigin: origin
    })

    expect(rows().map((row) => row.userId)).toEqual(['alice'])
  })
})
