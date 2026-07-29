/**
 * Push notification pipeline:
 * Supabase Trigger → pgmq queue → pgmqConsumer → BullMQ → Web Push API
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
