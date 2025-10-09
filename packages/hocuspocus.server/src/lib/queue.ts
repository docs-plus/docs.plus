import { Queue, Worker, Job } from 'bullmq'
import { prisma } from './prisma'
import { getRedisClient } from './redis'
import * as Y from 'yjs'

interface StoreDocumentData {
  documentName: string
  state: string // base64 encoded
  context: {
    slug?: string
    user?: {
      sub?: string
      email?: string
    }
  }
  commitMessage?: string
  firstCreation: boolean
}

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

export const StoreDocumentQueue = new Queue<StoreDocumentData>('store-documents', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600 // 24 hours
    },
    removeOnFail: {
      age: 7 * 24 * 3600 // 7 days
    }
  }
})

// Worker to process document storage jobs
export const createDocumentWorker = () => {
  const redisPublisher = getRedisClient()

  return new Worker<StoreDocumentData>(
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
      } catch (err) {
        console.error('Error storing data:', err)
        throw err // Re-throw to trigger retry
      }
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 300,
        duration: 1000
      }
    }
  )
}
