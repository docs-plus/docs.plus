import type { Document } from '@hocuspocus/server'

import { redisLogger } from './logger'
import { getRedisPublisher } from './redis'

export const documentAccessChannel = (documentId: string) => `doc:${documentId}:access`

export type DocumentAccessEvent = {
  documentId: string
  isPrivate?: boolean
  readOnly?: boolean
  ownerId: string | null
  timestamp: string
}

/** REST → WS seal channel. Returns false if Redis is down or publish throws. */
export async function publishDocumentAccessEvent(event: DocumentAccessEvent): Promise<boolean> {
  const publisher = getRedisPublisher()
  if (!publisher) {
    redisLogger.warn(
      { documentId: event.documentId },
      'Redis publisher unavailable; document access event not broadcast'
    )
    return false
  }

  try {
    await publisher.publish(documentAccessChannel(event.documentId), JSON.stringify(event))
    return true
  } catch (err) {
    redisLogger.error(
      { err, documentId: event.documentId },
      'Failed to publish document access event'
    )
    return false
  }
}

/** Broadcast access flags and seal non-owner connections when Private turns on. */
export function handleDocumentAccessEvent(
  document: Document,
  documentId: string,
  data: DocumentAccessEvent
): void {
  if (typeof data.readOnly === 'boolean') {
    document.broadcastStateless(JSON.stringify({ type: 'readOnly', state: data.readOnly }))
  }

  if (data.isPrivate === true) {
    document.broadcastStateless(JSON.stringify({ type: 'private', state: true }))
    const ownerId = data.ownerId
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
