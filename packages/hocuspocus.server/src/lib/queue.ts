import { Queue, Worker, Job } from 'bullmq'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { createRedisConnection, getRedisPublisher } from './redis'
import { queueLogger } from './logger'
import { sendNewDocumentNotification } from './email/document-notification'
import type { StoreDocumentData, DeadLetterJobData } from '../types'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Upsert document metadata with retry on slug collision (handles P2002)
async function upsertDocumentMetadata(
  tx: TransactionClient,
  params: {
    documentId: string
    baseSlug: string
    title: string
    ownerId?: string
    email?: string
  },
  maxRetries = 3
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // First attempt uses base slug, retries add timestamp + random suffix
    const slug = attempt === 0
      ? params.baseSlug
      : `${params.baseSlug}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    try {
      await tx.documentMetadata.upsert({
        where: { documentId: params.documentId },
        update: {
          title: params.title,
          description: params.title,
          ownerId: params.ownerId,
          email: params.email,
          keywords: ''
        },
        create: {
          documentId: params.documentId,
          slug,
          title: params.title,
          description: params.title,
          ownerId: params.ownerId,
          email: params.email,
          keywords: ''
        }
      })
      return slug
    } catch (err) {
      // P2002 = unique constraint violation
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = err.meta?.target as string[] | undefined
        if (target?.includes('slug') && attempt < maxRetries) {
          queueLogger.debug({ attempt, baseSlug: params.baseSlug }, 'Slug collision, retrying with new slug')
          continue
        }
      }
      throw err
    }
  }
  // Fallback: should not reach here but just in case
  throw new Error(`Failed to create unique slug after ${maxRetries} attempts`)
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

        // Use transaction with serializable isolation to prevent race conditions
        const { savedDoc, createdSlug, isFirstCreation } = await prisma.$transaction(async (tx) => {
          // Use raw query with FOR UPDATE to actually lock the row
          const existingDocs = await tx.$queryRaw<{ id: number; version: number }[]>`
            SELECT id, version FROM "Documents"
            WHERE "documentId" = ${data.documentName}
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
          `
          const existingDoc = existingDocs[0] ?? null

          const isFirst = !existingDoc
          const nextVersion = existingDoc ? existingDoc.version + 1 : 1

          // Handle first-time document creation with retry on slug collision
          let slug: string | undefined
          if (isFirst) {
            const baseSlug = context.slug || data.documentName
            slug = await upsertDocumentMetadata(tx, {
              documentId: data.documentName,
              baseSlug,
              title: baseSlug,
              ownerId: context.user?.sub,
              email: context.user?.email
            })
          }

          // Create new version (within transaction = atomic)
          const doc = await tx.documents.create({
            data: {
              documentId: data.documentName,
              commitMessage: data.commitMessage || '',
              version: nextVersion,
              data: Buffer.from(data.state, 'base64')
            }
          })

          return { savedDoc: doc, createdSlug: slug, isFirstCreation: isFirst }
        })

        const duration = Date.now() - startTime
        queueLogger.info(
          { jobId: job.id, duration: `${duration}ms` },
          'Document stored successfully'
        )

        // Send email notification AFTER transaction commits (fire-and-forget)
        if (isFirstCreation && createdSlug) {
          const userMeta = context.user?.user_metadata
          setImmediate(() => {
            sendNewDocumentNotification({
              documentId: data.documentName,
              documentName: context.slug || data.documentName,
              slug: createdSlug,
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
          })
        }

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
