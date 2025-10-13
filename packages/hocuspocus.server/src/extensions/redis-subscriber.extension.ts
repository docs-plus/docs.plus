import type { Extension } from '@hocuspocus/server'
import { getRedisClient } from '../lib/redis'
import type { SaveConfirmation } from '../types'

export class RedisSubscriberExtension implements Extension {
  private subscriber: any = null
  private subscribedDocs = new Set<string>()

  async onConfigure({ instance }: any) {
    this.subscriber = getRedisClient()

    if (!this.subscriber) {
      console.warn('Redis not available, save confirmations disabled')
      return
    }

    // Use pattern subscription for document-specific channels
    await this.subscriber.psubscribe('doc:*:saved', (err: Error | null) => {
      if (err) {
        console.error('Failed to subscribe to document channels:', err)
      } else {
        console.info('✅ Subscribed to document save channels (pattern: doc:*:saved)')
      }
    })

    // Handle incoming save confirmations
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
          console.info(`📝 Broadcasted save confirmation for ${documentId} v${data.version}`)
        }
      } catch (err) {
        console.error('Error processing save confirmation:', err)
      }
    })
  }

  async onDestroy() {
    if (this.subscriber) {
      await this.subscriber.punsubscribe('doc:*:saved')
      await this.subscriber.quit()
      console.info('🔌 Unsubscribed from Redis channels')
    }
  }
}
