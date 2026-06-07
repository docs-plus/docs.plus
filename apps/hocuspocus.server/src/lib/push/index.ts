/**
 * Push Notification Module
 *
 * ARCHITECTURE (pgmq Consumer):
 *   Supabase Trigger → pgmq queue → pgmqConsumer → BullMQ → Web Push API
 *
 * The pgmqConsumer polls the Supabase queue every 2 seconds.
 * BullMQ worker sends push notifications via Web Push API.
 *
 * @see docs/PUSH_NOTIFICATION_PGMQ.md
 */

// pgmq Consumer - polls Supabase queue
export {
  getPushQueueConsumerHealth,
  startPushQueueConsumer,
  stopPushQueueConsumer
} from './pgmqConsumer'

// BullMQ Queue - internal processing
export { closePushQueue, createPushWorker, getPushQueueHealth, queuePush } from './queue'

// Web Push Sender - actual push API calls
export { configureVapid, isVapidConfigured, sendPushNotification } from './sender'

// Gateway Service - manages initialization/shutdown
export { pushGateway, PushGatewayService } from './service'
