/**
 * Generic pgmq Consumer
 *
 * Shared poll/ack/metrics/lifecycle for Supabase pgmq queues. Email and push
 * inject only their RPC names and per-message mapping; everything else (the
 * single-flight poll guard, empty-poll counter, batch settle, graceful stop)
 * is identical across both and lives here.
 */

import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from 'pino'

import { getServiceRoleClient } from './supabase'

/**
 * Deterministic BullMQ jobId from stable business fields, used when a payload has
 * no single id (e.g. digests). Identical fields → identical id → pgmq redelivery
 * collapses to one job instead of a duplicate notification. BullMQ uses ':' as a
 * Redis key separator, so '-' joins the prefix.
 */
export function deterministicJobId(prefix: string, ...fields: (string | undefined)[]): string {
  const digest = createHash('sha256').update(fields.join('|')).digest('hex').slice(0, 32)
  return `${prefix}-${digest}`
}

export interface PgmqMessage<TPayload> {
  msg_id: number
  payload: TPayload
  enqueued_at: string
}

export interface PgmqConsumerMetrics {
  messagesProcessed: number
  messagesFailed: number
  lastPollAt: Date | null
  lastMessageAt: Date | null
  consecutiveEmptyPolls: number
}

export interface PgmqConsumerOptions<TPayload> {
  /** Human label used in log lines, e.g. 'email' or 'push'. */
  label: string
  logger: Logger
  /** RPC that reads + leases a batch (consume_email_queue / consume_push_queue). */
  readRpc: string
  /** RPC that removes an acked message (ack_email_message / ack_push_message). */
  ackRpc: string
  pollIntervalMs: number
  batchSize: number
  visibilityTimeout: number
  /**
   * Map + enqueue one message. Returning true counts it processed; the consumer
   * owns the ack and metrics so handlers cannot drift on those.
   */
  processMessage: (payload: TPayload, msgId: number, ctx: PgmqConsumerContext) => Promise<boolean>
}

/** Helpers exposed to processMessage so handlers reuse the shared client. */
export interface PgmqConsumerContext {
  getClient: () => SupabaseClient | null
}

export interface PgmqConsumer {
  start: () => boolean
  stop: () => Promise<void>
  getHealth: () => { running: boolean; metrics: PgmqConsumerMetrics }
}

export function createPgmqConsumer<TPayload>(options: PgmqConsumerOptions<TPayload>): PgmqConsumer {
  const { label, logger, readRpc, ackRpc, pollIntervalMs, batchSize, visibilityTimeout } = options

  let supabase: SupabaseClient | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let isProcessing = false
  let isShuttingDown = false

  // Empty-poll backoff: double the base interval up to a cap so an idle queue
  // stops hammering the read RPC. consecutiveEmptyPolls resets on any non-empty
  // poll, which drops the next delay straight back to the base.
  const BACKOFF_CAP_MS = Math.max(pollIntervalMs, 10_000)
  function nextDelayMs(): number {
    if (metrics.consecutiveEmptyPolls === 0) return pollIntervalMs
    const grown = pollIntervalMs * 2 ** Math.min(metrics.consecutiveEmptyPolls, 10)
    return Math.min(grown, BACKOFF_CAP_MS)
  }

  function scheduleNextPoll(): void {
    if (isShuttingDown) return
    pollTimer = setTimeout(runPollCycle, nextDelayMs())
  }

  async function runPollCycle(): Promise<void> {
    await pollQueue()
    scheduleNextPoll()
  }

  const metrics: PgmqConsumerMetrics = {
    messagesProcessed: 0,
    messagesFailed: 0,
    lastPollAt: null,
    lastMessageAt: null,
    consecutiveEmptyPolls: 0
  }

  function getClient(): SupabaseClient | null {
    if (supabase) return supabase

    supabase = getServiceRoleClient()
    if (!supabase) {
      logger.warn(`Supabase not configured - ${label} pgmq consumer will not start`)
    }
    return supabase
  }

  async function readQueue(): Promise<PgmqMessage<TPayload>[]> {
    const client = getClient()
    if (!client) return []

    try {
      const { data, error } = await client.rpc(readRpc, {
        p_batch_size: batchSize,
        p_visibility_timeout: visibilityTimeout
      })
      if (error) {
        logger.error({ error }, `Failed to read ${label} queue`)
        return []
      }
      return (data || []) as PgmqMessage<TPayload>[]
    } catch (err) {
      logger.error({ err }, `Error reading ${label} queue`)
      return []
    }
  }

  async function ackMessage(msgId: number): Promise<boolean> {
    const client = getClient()
    if (!client) return false

    try {
      const { error } = await client.rpc(ackRpc, { p_msg_id: msgId })
      if (error) {
        logger.error({ error, msgId }, `Failed to ack ${label} message`)
        return false
      }
      return true
    } catch (err) {
      logger.error({ err, msgId }, `Error acking ${label} message`)
      return false
    }
  }

  const ctx: PgmqConsumerContext = { getClient }

  async function handleMessage(message: PgmqMessage<TPayload>): Promise<boolean> {
    const ok = await options.processMessage(message.payload, message.msg_id, ctx)
    if (!ok) {
      metrics.messagesFailed++
      return false
    }

    // Enqueue succeeded; ack so pgmq stops redelivering. A failed ack only risks
    // redelivery, which the stable BullMQ jobId now collapses.
    const acked = await ackMessage(message.msg_id)
    if (!acked) {
      logger.warn({ msgId: message.msg_id }, `Failed to ack ${label} message - may be reprocessed`)
    }

    metrics.messagesProcessed++
    metrics.lastMessageAt = new Date()
    return true
  }

  async function pollQueue(): Promise<void> {
    if (isProcessing || isShuttingDown) return

    isProcessing = true
    metrics.lastPollAt = new Date()

    try {
      const messages = await readQueue()
      if (messages.length === 0) {
        metrics.consecutiveEmptyPolls++
        return
      }

      metrics.consecutiveEmptyPolls = 0
      logger.debug({ count: messages.length }, `Processing ${label} queue batch`)

      const results = await Promise.allSettled(messages.map(handleMessage))
      const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value).length
      const failed = results.length - succeeded
      if (failed > 0) {
        logger.warn({ succeeded, failed }, `Some ${label} queue messages failed`)
      }
    } catch (err) {
      logger.error({ err }, `Error in ${label} queue poll cycle`)
    } finally {
      isProcessing = false
    }
  }

  return {
    start(): boolean {
      if (pollTimer) {
        logger.warn(`${label} queue consumer already running`)
        return false
      }
      if (!getClient()) {
        logger.error(`Cannot start ${label} queue consumer - Supabase not configured`)
        return false
      }

      logger.info(
        { pollInterval: pollIntervalMs, batchSize, visibilityTimeout },
        `Starting ${label} queue consumer (pgmq architecture)`
      )

      isShuttingDown = false
      runPollCycle()
      return true
    },

    async stop(): Promise<void> {
      isShuttingDown = true
      if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
      }

      let waitCount = 0
      while (isProcessing && waitCount < 10) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        waitCount++
      }

      logger.info(
        { messagesProcessed: metrics.messagesProcessed, messagesFailed: metrics.messagesFailed },
        `${label} queue consumer stopped`
      )
    },

    getHealth() {
      return {
        running: pollTimer !== null && !isShuttingDown,
        metrics: { ...metrics }
      }
    }
  }
}
