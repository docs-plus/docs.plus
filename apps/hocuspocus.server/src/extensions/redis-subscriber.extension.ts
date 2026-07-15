import type { Extension } from '@hocuspocus/server'

import { handleDocumentAccessEvent } from '../lib/accessRealtime'
import { redisLogger } from '../lib/logger'
import { getRedisSubscriber } from '../lib/redis'
import type { RedisClient, SaveConfirmation } from '../types'

export class RedisSubscriberExtension implements Extension {
  private subscriber: RedisClient | null = null
  private pmessageHandler: ((pattern: string, channel: string, message: string) => void) | null =
    null

  async onConfigure({ instance }: any) {
    this.subscriber = getRedisSubscriber()

    if (!this.subscriber) {
      redisLogger.warn('Redis not available, save confirmations disabled')
      return
    }

    try {
      this.subscriber.psubscribe('doc:*:saved', 'doc:*:access', (err, count) => {
        if (err) {
          redisLogger.error({ err }, 'Failed to psubscribe to doc:* channels')
        } else {
          redisLogger.info({ count }, 'Subscribed to doc:*:saved and doc:*:access')
        }
      })

      this.pmessageHandler = (_pattern: string, channel: string, message: string) => {
        try {
          const documentId = channel.split(':')[1]
          const document = instance.documents.get(documentId)
          if (!document) return

          if (channel.endsWith(':saved')) {
            const data: SaveConfirmation = JSON.parse(message)
            document.broadcastStateless(
              JSON.stringify({
                msg: 'document:saved',
                documentId: data.documentId,
                version: data.version,
                timestamp: data.timestamp
              })
            )
            redisLogger.info({ documentId, version: data.version }, 'Broadcasted save confirmation')
            return
          }

          if (channel.endsWith(':access')) {
            handleDocumentAccessEvent(document, documentId, JSON.parse(message))
          }
        } catch (err) {
          redisLogger.error({ err, channel }, 'Error processing Redis document channel message')
        }
      }
      this.subscriber.on('pmessage', this.pmessageHandler)
    } catch (err) {
      redisLogger.error({ err }, 'Failed to subscribe to document channels')
    }
  }

  async onDestroy() {
    if (this.subscriber) {
      try {
        await this.subscriber.punsubscribe('doc:*:saved', 'doc:*:access')
        if (this.pmessageHandler) this.subscriber.off('pmessage', this.pmessageHandler)
        redisLogger.info('Unsubscribed from Redis document channels')
      } catch (err) {
        redisLogger.error({ err }, 'Error unsubscribing from Redis channels')
      }
    }
  }
}
