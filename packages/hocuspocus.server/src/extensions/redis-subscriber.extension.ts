import type { Extension } from '@hocuspocus/server'
import { getRedisSubscriber } from '../lib/redis'
import { redisLogger } from '../lib/logger'
import type { SaveConfirmation, RedisClient } from '../types'

export class RedisSubscriberExtension implements Extension {
  private subscriber: RedisClient | null = null

  async onConfigure({ instance }: any) {
    // Get dedicated Redis client for subscriptions (ioredis)
    // Note: Subscription mode takes over the connection, so we need a dedicated client
    this.subscriber = getRedisSubscriber()

    if (!this.subscriber) {
      redisLogger.warn('Redis not available, save confirmations disabled')
      return
    }

    try {
      // Subscribe to pattern: doc:*:saved
      // ioredis psubscribe syntax
      this.subscriber.psubscribe('doc:*:saved', (err, count) => {
        if (err) {
          redisLogger.error({ err }, 'Failed to psubscribe to doc:*:saved')
        } else {
          redisLogger.info({ count }, '✅ Subscribed to document save channels (pattern: doc:*:saved)')
        }
      })

      // Handle pattern messages
      this.subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
        try {
          // Extract documentId from channel name: doc:abc123:saved -> abc123
          const documentId = channel.split(':')[1]
          const data: SaveConfirmation = JSON.parse(message)

          // Only process if document is loaded on THIS server
          const document = instance.documents.get(documentId)
          if (document) {
            document.broadcastStateless(
              JSON.stringify({
                msg: 'document:saved',
                documentId: data.documentId,
                version: data.version,
                timestamp: data.timestamp
              })
            )
            redisLogger.info(
              { documentId, version: data.version },
              '📝 Broadcasted save confirmation'
            )
          }
        } catch (err) {
          redisLogger.error({ err, channel }, 'Error processing save confirmation')
        }
      })
    } catch (err) {
      redisLogger.error({ err }, 'Failed to subscribe to document channels')
    }
  }

  async onDestroy() {
    if (this.subscriber) {
      try {
        await this.subscriber.punsubscribe('doc:*:saved')
        redisLogger.info('🔌 Unsubscribed from Redis channels')
      } catch (err) {
        redisLogger.error({ err }, 'Error unsubscribing from Redis channels')
      }
    }
  }
}
