import { Queue, Worker, Job } from 'bullmq'
import { prisma } from './prisma'
import { getRedisClient } from './redis'
import type { StoreDocumentData, DeadLetterJobData } from '../types'
import * as Y from 'yjs'

async function generateUniqueSlug(baseSlug: string): Promise<string> {
  const existing = await prisma.documentMetadata.findUnique({ where: { slug: baseSlug } })
  if (!existing) return baseSlug

  // If slug exists, append timestamp + random to make it unique
  return `${baseSlug}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
}

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
}

// Main queue for storing documents
export const StoreDocumentQueue = new Queue<StoreDocumentData>('store-documents', {
  connection,
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
  connection,
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
  console.error('❌ Queue error:', err)
})

// Worker to process document storage jobs
export const createDocumentWorker = () => {
  const redisPublisher = getRedisClient()

  const worker = new Worker<StoreDocumentData>(
    'store-documents',
    async (job: Job<StoreDocumentData>) => {
      const { data } = job

      try {
        console.time(`Store Data, jobId:${job.id}`)

        if (data.firstCreation) {
          const context = data.context

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
              slug: await generateUniqueSlug(context.slug || data.documentName),
              title: context.slug || data.documentName,
              description: context.slug || data.documentName,
              ownerId: context.user?.sub,
              email: context.user?.email,
              keywords: ''
            }
          })
        }

        const currentDoc = await prisma.documents.findFirst({
          where: { documentId: data.documentName },
          orderBy: { version: 'desc' }
        })

        // Create a new version
        const savedDoc = await prisma.documents.create({
          data: {
            documentId: data.documentName,
            commitMessage: data.commitMessage || '',
            version: currentDoc ? currentDoc.version + 1 : 1,
            data: Buffer.from(data.state, 'base64')
          }
        })

        console.timeEnd(`Store Data, jobId:${job.id}`)

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
        console.error(`❌ Error storing data for job ${job.id}:`, err)

        // If this is the final attempt, move to dead letter queue
        if (job.attemptsMade >= (job.opts.attempts || 5)) {
          console.error(`💀 Job ${job.id} exhausted all retries. Moving to DLQ.`)
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
      connection,
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
    console.log(`✅ Job ${job.id} completed successfully`)
  })

  worker.on('failed', (job, err) => {
    if (job) {
      console.error(`❌ Worker: Job ${job.id} failed:`, err.message)
    }
  })

  worker.on('error', (err) => {
    console.error('❌ Worker error:', err)
  })

  worker.on('stalled', (jobId) => {
    console.warn(`⚠️  Worker: Job ${jobId} stalled`)
  })

  return worker
}
