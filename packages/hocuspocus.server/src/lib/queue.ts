import { Queue, Worker, Job } from 'bullmq'
import { prisma } from './prisma'
import { createRedisConnection, getRedisPublisher } from './redis'
import { queueLogger } from './logger'
import { sendNewDocumentNotification } from './email'
import type { StoreDocumentData, DeadLetterJobData } from '../types'

async function generateUniqueSlug(baseSlug: string): Promise<string> {
  const existing = await prisma.documentMetadata.findUnique({ where: { slug: baseSlug } })
  if (!existing) return baseSlug

  // If slug exists, append timestamp + random to make it unique
  return `${baseSlug}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
}

// BullMQ connection options (shared base config)
const bullmqConnectionOptions = {
  maxRetriesPerRequest: null, // BullMQ requirement - allows unlimited retries
  enableReadyCheck: true,
  enableOfflineQueue: true,
  commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '60000', 10),
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000', 10),
  keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000', 10)
}

// Queue connection (non-blocking operations)
const queueConnection = createRedisConnection(bullmqConnectionOptions)

if (!queueConnection) {
  queueLogger.error('Failed to create Redis connection for BullMQ Queue')
  throw new Error('Redis configuration required for queue operations')
}

// Worker connection (blocking operations - MUST be separate)
// BullMQ uses BRPOPLPUSH which blocks the connection
const createWorkerConnection = () => {
  const conn = createRedisConnection(bullmqConnectionOptions)
  if (!conn) {
    queueLogger.error('Failed to create Redis connection for BullMQ Worker')
    throw new Error('Redis configuration required for worker operations')
  }
  return conn
}

// Main queue for storing documents
export const StoreDocumentQueue = new Queue<StoreDocumentData>('store-documents', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5, // Increased retry attempts for better reliability
    backoff: {
      type: 'exponential',
      delay: 2000 // Start with 2s delay
    },
    removeOnComplete: {
      count: 1000, // Keep more completed jobs for debugging
      age: 24 * 3600 // 24 hours
    },
    removeOnFail: false // NEVER auto-remove failed jobs in production
  }
})

// Dead Letter Queue for permanently failed jobs
export const DeadLetterQueue = new Queue<StoreDocumentData>('store-documents-dlq', {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 500,
      age: 30 * 24 * 3600 // Keep for 30 days
    }
  }
})

// Event handlers for monitoring and alerting
// Note: Queue events are handled by Worker events below for better reliability
StoreDocumentQueue.on('error', (err: Error) => {
  queueLogger.error({ err }, 'Queue error')
})

// Worker to process document storage jobs
export const createDocumentWorker = () => {
  const redisPublisher = getRedisPublisher()
  // Worker MUST have dedicated connection (uses blocking commands)
  const workerConnection = createWorkerConnection()

  const worker = new Worker<StoreDocumentData>(
    'store-documents',
    async (job: Job<StoreDocumentData>) => {
      const { data } = job

      try {
        const startTime = Date.now()
        const context = data.context

        // Check if this is the first time this document is being saved
        // IMPORTANT: Order by id DESC to get the LATEST record (id is auto-increment, always reliable)
        const existingDoc = await prisma.documents.findFirst({
          where: { documentId: data.documentName },
          orderBy: { id: 'desc' },
          select: { id: true, version: true }
        })
        const isFirstCreation = !existingDoc

        if (isFirstCreation) {
          const slug = await generateUniqueSlug(context.slug || data.documentName)

          await prisma.documentMetadata.upsert({
            where: {
              documentId: data.documentName
            },
            update: {
              // Don't update slug on existing documents to avoid conflicts
              title: context.slug || data.documentName,
              description: context.slug || data.documentName,
              ownerId: context.user?.sub,
              email: context.user?.email,
              keywords: ''
            },
            create: {
              documentId: data.documentName,
              slug,
              title: context.slug || data.documentName,
              description: context.slug || data.documentName,
              ownerId: context.user?.sub,
              email: context.user?.email,
              keywords: ''
            }
          })
          // Send email notification for new document (fire-and-forget, don't block queue)
          const userMeta = context.user?.user_metadata
          sendNewDocumentNotification({
            documentId: data.documentName,
            documentName: context.slug || data.documentName,
            slug,
            creatorEmail: context.user?.email,
            creatorId: context.user?.sub,
            creatorName: userMeta?.full_name || userMeta?.name,
            creatorAvatarUrl: userMeta?.avatar_url,
            createdAt: new Date()
          }).catch((err) => {
            queueLogger.error(
              { err, documentId: data.documentName },
              'Failed to send new document notification email'
            )
          })
        }

        const currentDoc = existingDoc

        // Create a new version
        const savedDoc = await prisma.documents.create({
          data: {
            documentId: data.documentName,
            commitMessage: data.commitMessage || '',
            version: currentDoc ? currentDoc.version + 1 : 1,
            data: Buffer.from(data.state, 'base64')
          }
        })

        const duration = Date.now() - startTime
        queueLogger.info(
          { jobId: job.id, duration: `${duration}ms` },
          'Document stored successfully'
        )

        // Publish save confirmation to document-specific Redis channel
        if (redisPublisher) {
          await redisPublisher.publish(
            `doc:${data.documentName}:saved`,
            JSON.stringify({
              documentId: data.documentName,
              version: savedDoc.version,
              timestamp: Date.now()
            })
          )
        }

        return { success: true, version: savedDoc.version }
      } catch (err) {
        queueLogger.error({ err, jobId: job.id }, 'Error storing data for job')

        // If this is the final attempt, move to dead letter queue
        if (job.attemptsMade >= (job.opts.attempts || 5)) {
          queueLogger.error({ jobId: job.id }, 'Job exhausted all retries. Moving to DLQ')
          await DeadLetterQueue.add('failed-document', {
            ...data,
            originalJobId: job.id,
            failureReason: err instanceof Error ? err.message : 'Unknown error',
            failedAt: new Date().toISOString()
          } as any)
        }

        throw err // Re-throw to trigger retry
      }
    },
    {
      connection: workerConnection,
      concurrency: parseInt(process.env.BULLMQ_CONCURRENCY || '5', 10),
      limiter: {
        max: parseInt(process.env.BULLMQ_RATE_LIMIT_MAX || '300', 10),
        duration: parseInt(process.env.BULLMQ_RATE_LIMIT_DURATION || '1000', 10)
      },
      // Auto-remove stalled jobs after timeout
      stalledInterval: 30000, // Check every 30s
      maxStalledCount: 3 // After 3 stalls, consider it failed
    }
  )

  // Worker event handlers
  worker.on('completed', (job) => {
    queueLogger.info({ jobId: job.id }, 'Job completed successfully')
  })

  worker.on('failed', (job, err) => {
    if (job) {
      queueLogger.error({ jobId: job.id, err }, 'Worker: Job failed')
    }
  })

  worker.on('error', (err) => {
    queueLogger.error({ err }, 'Worker error')
  })

  worker.on('stalled', (jobId) => {
    queueLogger.warn({ jobId }, 'Worker: Job stalled')
  })

  return worker
}
