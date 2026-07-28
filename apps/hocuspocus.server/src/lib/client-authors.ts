import type { PrismaClient } from '@prisma/client'
import * as Y from 'yjs'

import type { StoreDocumentContext } from '../types'
import { logger } from './logger'

const clientAuthorLogger = logger.child({ service: 'client-authors' })

export interface ClientAuthorBinding {
  clientId: number
  userId: string
  isAnonymous: boolean
}

// Narrowed to the two reads the guard makes, so a unit test can stand in a room
// without constructing a Hocuspocus Document.
interface ClientAuthorRoom {
  getClients: (socket: object) => Set<number>
  getMap: (name: string) => { get: (key: string) => unknown }
}

export interface ClientAuthorChange {
  document: ClientAuthorRoom
  documentName: string
  context: StoreDocumentContext | null | undefined
  update: Uint8Array
  transactionOrigin: { webSocket?: object } | null | undefined
}

// Keyed by the live Document so the set dies with the room. Holds the clientIDs
// already bound (or in flight), which keeps a typing burst to one write.
const boundByDocument = new WeakMap<object, Set<number>>()

/**
 * Binds the clientIDs a socket announces to that socket's user, first claim wins.
 * Never throws: it runs inside the sequential onChange chain, where a rejection
 * would abort the hooks behind it, and silence beats a misattributed range.
 *
 * Best-effort provenance, NOT an audit trail — see `docs/change-attribution.md`.
 */
export const recordClientAuthors = (prisma: PrismaClient, change: ClientAuthorChange): void => {
  try {
    const socket = change.transactionOrigin?.webSocket
    if (!socket) return

    const userId = change.context?.user?.sub
    if (typeof userId !== 'string' || userId.length === 0) return

    // A draft is row-less by design until its first real edit clears the flag,
    // so the foreign key has no target yet and every write here would fail.
    if (change.document.getMap('metadata').get('isDraft')) return

    // Populated from the `added` list of awareness messages on this exact socket.
    // That rules out replayed sync structs — the accidental mis-binding this guard
    // exists for — but it is NOT proof of ownership: y-protocols accepts whatever
    // clientID a socket announces, and Yjs authenticates no authorship at all.
    const announced = change.document.getClients(socket)
    if (announced.size === 0) return

    let bound = boundByDocument.get(change.document)
    if (!bound) {
      bound = new Set<number>()
      boundByDocument.set(change.document, bound)
    }

    let hasUnbound = false
    for (const clientId of announced) {
      if (!bound.has(clientId)) {
        hasUnbound = true
        break
      }
    }
    if (!hasUnbound) return

    let authors: Map<number, number>
    try {
      authors = Y.parseUpdateMeta(change.update).from
    } catch {
      return
    }

    const pending: number[] = []
    for (const clientId of authors.keys()) {
      if (!announced.has(clientId) || bound.has(clientId)) continue
      bound.add(clientId)
      pending.push(clientId)
    }
    if (pending.length === 0) return

    const isAnonymous = change.context?.user?.is_anonymous === true
    void prisma.documentClientAuthor
      .createMany({
        data: pending.map((clientId) => ({
          documentId: change.documentName,
          clientId: BigInt(clientId),
          userId,
          isAnonymous
        })),
        skipDuplicates: true
      })
      .catch((err: unknown) => {
        for (const clientId of pending) bound.delete(clientId)
        clientAuthorLogger.warn(
          { err, documentName: change.documentName },
          'Client author binding failed'
        )
      })
  } catch (err) {
    clientAuthorLogger.warn({ err }, 'Client author capture skipped')
  }
}

export const resolveClientAuthors = async (
  prisma: PrismaClient,
  documentId: string,
  clientIds: number[]
): Promise<ClientAuthorBinding[]> => {
  if (clientIds.length === 0) return []

  const rows = await prisma.documentClientAuthor.findMany({
    where: { documentId, clientId: { in: clientIds.map((id) => BigInt(id)) } },
    select: { clientId: true, userId: true, isAnonymous: true }
  })

  return rows.map((row) => ({
    clientId: Number(row.clientId),
    userId: row.userId,
    isAnonymous: row.isAnonymous
  }))
}
