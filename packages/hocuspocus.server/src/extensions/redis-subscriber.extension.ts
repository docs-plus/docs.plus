import type { Extension } from '@hocuspocus/server'
import { getRedisClient } from '../lib/redis'
import type { SaveConfirmation } from '../types'

export class RedisSubscriberExtension implements Extension {
  private subscriber: any = null

  async onConfigure({ instance }: any) {
    // Create a separate Redis client for subscriptions
    // Note: Subscription mode takes over the connection, so we need a dedicated client
    this.subscriber = getRedisClient()?.duplicate()

    if (!this.subscriber) {
      console.warn('Redis not available, save confirmations disabled')
      return
    }

    try {
      // Bun's native Redis psubscribe for pattern matching
      await this.subscriber.psubscribe('doc:*:saved', (message: string, channel: string) => {
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
            console.info(`📝 Broadcasted save confirmation for ${documentId} v${data.version}`)
          }
        } catch (err) {
          console.error('Error processing save confirmation:', err)
        }
      })

      console.info('✅ Subscribed to document save channels (pattern: doc:*:saved)')
    } catch (err) {
      console.error('Failed to subscribe to document channels:', err)
    }
  }

  async onDestroy() {
    if (this.subscriber) {
      await this.subscriber.punsubscribe('doc:*:saved')
      this.subscriber.close()
      console.info('🔌 Unsubscribed from Redis channels')
    }
  }
}
