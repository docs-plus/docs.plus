import type { Document } from '@hocuspocus/server'

import { redisLogger } from './logger'
import { getRedisPublisher } from './redis'

export const documentAccessChannel = (documentId: string) => `doc:${documentId}:access`

export type DocumentAccessEvent = {
  documentId: string
  isPrivate?: boolean
  readOnly?: boolean
  deleted?: boolean
  // Set only by purgeDocumentFootprint. A soft delete closes the room but must
  // still flush: its Documents rows survive, so nothing can resurrect, and the
  // dropped window would be work Trash cannot restore.
  purged?: boolean
  ownerId: string | null
  timestamp: string
}

/** REST → WS seal channel. Failures are logged here; callers fire-and-forget. */
export async function publishDocumentAccessEvent(event: DocumentAccessEvent): Promise<void> {
  const publisher = getRedisPublisher()
  if (!publisher) {
    redisLogger.warn(
      { documentId: event.documentId },
      'Redis publisher unavailable; document access event not broadcast'
    )
    return
  }

  try {
    await publisher.publish(documentAccessChannel(event.documentId), JSON.stringify(event))
  } catch (err) {
    redisLogger.error(
      { err, documentId: event.documentId },
      'Failed to publish document access event'
    )
  }
}

// Keyed on the Document object so it needs no cap and no sweep: the entry dies
// with the room. `store()` receives the same instance the subscriber resolves.
const sealedRooms = new WeakSet<object>()

/** A deleted room: its forced close-time flush must not re-create the row. */
export const isRoomSealed = (document: object): boolean => sealedRooms.has(document)

/** Broadcast access flags and seal connections when Private or Deleted turns on. */
export function handleDocumentAccessEvent(
  document: Document,
  documentId: string,
  data: DocumentAccessEvent
): void {
  if (data.deleted === true) {
    // Only a purge seals. It removes the metadata row, so the forced close-time
    // flush would hit the worker's first-save branch and re-create the document.
    // A soft delete keeps every Documents row, so that branch cannot fire and
    // dropping the flush would only cost every collaborator their last window.
    if (data.purged === true) sealedRooms.add(document)
    document.broadcastStateless(JSON.stringify({ type: 'deleted', state: true }))
    for (const connection of document.getConnections()) connection.close()
    redisLogger.info({ documentId, sealed: data.purged === true }, 'Closed deleted document room')
    return
  }

  if (data.deleted === false) {
    // A restore landing inside the close-to-unload gap can re-attach a client to
    // this same Document; leaving it sealed would drop its saves silently.
    sealedRooms.delete(document)
    return
  }

  if (typeof data.readOnly === 'boolean') {
    const readOnly = data.readOnly
    document.broadcastStateless(JSON.stringify({ type: 'readOnly', state: readOnly }))
    // MessageReceiver reads this per message, so already-open sockets need it
    // too. On an ownerless document this marks every socket read-only while the
    // client predicate keeps the editor live — the same divergence handshake
    // already has, not a new one.
    for (const connection of document.getConnections()) {
      connection.readOnly = readOnly && connection.context?.user?.sub !== data.ownerId
    }
  }

  if (data.isPrivate === true) {
    const ownerId = data.ownerId
    // Carry ownerId so clients decide the redirect on seal-fresh data instead
    // of possibly-stale store metadata; the close below enforces either way.
    document.broadcastStateless(JSON.stringify({ type: 'private', state: true, ownerId }))
    for (const connection of document.getConnections()) {
      if (connection.context?.user?.sub !== ownerId) {
        connection.close()
      }
    }
    redisLogger.info({ documentId }, 'Sealed private document room')
    return
  }

  if (data.isPrivate === false) {
    document.broadcastStateless(JSON.stringify({ type: 'private', state: false }))
  }
}
