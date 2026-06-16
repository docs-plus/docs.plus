/**
 * Notification Gateway Base
 *
 * Shared lifecycle for the email and push gateways: the initialize-once guard,
 * worker-mode tracking, "create worker only when enabled" rule, and shutdown
 * (close worker, then close queue). Subclasses inject provider setup + the
 * worker/queue factories and keep their own send methods.
 */

import type { Logger } from 'pino'

/** A BullMQ Worker exposes close(); we only need that here. */
interface ClosableWorker {
  close: () => Promise<void>
}

export interface GatewayHooks {
  label: string
  logger: Logger
  /** Provider/VAPID setup run on every initialize, before the worker is created. */
  configure: () => Promise<void> | void
  /** Build the BullMQ worker (worker mode only); null when Redis is absent. */
  createWorker: () => ClosableWorker | null
  /** Close the queue (and DLQ) connections. */
  closeQueue: () => Promise<void>
}

export abstract class NotificationGatewayBase {
  protected worker: ClosableWorker | null = null
  protected initialized = false
  protected workerMode = false

  protected constructor(private readonly hooks: GatewayHooks) {}

  async initialize(enableWorker = false): Promise<void> {
    if (this.initialized) return

    const { label, logger } = this.hooks
    this.workerMode = enableWorker
    logger.info({ workerMode: enableWorker }, `Initializing ${label} Gateway...`)

    await this.hooks.configure()

    if (enableWorker) {
      this.worker = this.hooks.createWorker()
      if (!this.worker) {
        logger.error(`Failed to create ${label.toLowerCase()} worker - Redis may not be configured`)
      }
    }

    this.initialized = true
    logger.info(
      {
        worker_enabled: this.worker !== null,
        mode: enableWorker ? 'worker' : 'queue-only'
      },
      `${label} Gateway initialized`
    )
  }

  async shutdown(): Promise<void> {
    const { label, logger } = this.hooks
    if (this.worker) {
      await this.worker.close()
      logger.info(`${label} worker stopped`)
    }
    await this.hooks.closeQueue()
    logger.info(`${label} Gateway shutdown complete`)
  }
}
