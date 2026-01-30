import * as Y from 'yjs'
import { Database } from '@hocuspocus/extension-database'
import { Throttle } from '@hocuspocus/extension-throttle'
import { Redis as RedisExtension } from '@hocuspocus/extension-redis'
import { Logger } from '@hocuspocus/extension-logger'
import { checkEnvBolean, generateRandomId } from '../utils'
import { StoreDocumentQueue } from '../lib/queue'
import { HealthCheck } from '../extensions/health.extension'
import { RedisSubscriberExtension } from '../extensions/redis-subscriber.extension'
import { DocumentViewsExtension } from '../extensions/document-views.extension'
import { prisma } from '../lib/prisma'
import { dbLogger } from '../lib/logger'

export { Database }

const getServerName = () => `${process.env.APP_NAME}_${generateRandomId(4)}`

const generateDefaultState = () => {
  const ydoc = new Y.Doc()
  const ymeta = ydoc.getMap('metadata')
  ymeta.set('needsInitialization', true)
  ymeta.set('isDraft', true)
  return Y.encodeStateAsUpdate(ydoc)
}

const healthCheck = new HealthCheck()

const configureExtensions = () => {
  const extensions: any[] = []

  if (checkEnvBolean(process.env.HOCUSPOCUS_THROTTLE)) {
    extensions.push(
      new Throttle({
        throttle: parseInt(process.env.HOCUSPOCUS_THROTTLE_ATTEMPTS || '10', 10),
        banTime: parseInt(process.env.HOCUSPOCUS_THROTTLE_BANTIME || '60000', 10)
      })
    )
  }

  if (checkEnvBolean(process.env.HOCUSPOCUS_LOGGER)) {
    extensions.push(
      new Logger({
        onLoadDocument: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_LOAD_DOCUMENT),
        onChange: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CHANGE),
        onConnect: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CONNECT),
        onDisconnect: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_DISCONNECT),
        onUpgrade: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_UPGRADE),
        onRequest: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_REQUEST),
        onListen: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_LISTEN),
        onDestroy: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_DESTROY),
        onConfigure: checkEnvBolean(process.env.HOCUSPOCUS_LOGGER_ON_CONFIGURE)
      })
    )
  }

  if (process.env.NODE_ENV === 'production' && checkEnvBolean(process.env.REDIS)) {
    // Note: @hocuspocus/extension-redis creates its own Redis connection
    // We configure it with the same settings as our centralized Redis
    const redisOptions: any = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10)
    }

    if (process.env.REDIS_PASSWORD) {
      redisOptions.options = {
        password: process.env.REDIS_PASSWORD
      }
    }

    extensions.push(new RedisExtension(redisOptions))
  }

  extensions.push(
    new Database({
      async fetch({ documentName }: { documentName: string }) {
        try {
          const doc = await prisma.documents.findFirst({
            where: { documentId: documentName },
            orderBy: { id: 'desc' }
          })
          return doc ? doc.data : generateDefaultState()
        } catch (err) {
          dbLogger.error({ err }, 'Error fetching document data')
          await prisma.$disconnect()
          throw err
        }
      },

      async store(data: any) {
        const { documentName, state, context } = data
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, state)
        const meta = ydoc.getMap('metadata')
        const commitMessageValue = meta.get('commitMessage')
        const commitMessage = typeof commitMessageValue === 'string' ? commitMessageValue : ''
        const isDraft = meta.get('isDraft') || false

        meta.delete('commitMessage')

        // If the document is draft, don't store the data
        if (isDraft) return

        // Clean up draft flag after first save
        if (meta.has('isDraft')) {
          meta.delete('isDraft')
        }

        // Create a new Y.Doc to store the updated state
        Y.applyUpdate(ydoc, state)
        const newState = Y.encodeStateAsUpdate(ydoc)
        const stateBase64 = Buffer.from(newState).toString('base64')

        try {
          // Primary: Add job to queue for async processing
          await StoreDocumentQueue.add('store-document', {
            documentName,
            state: stateBase64,
            context,
            commitMessage
          })
        } catch (err) {
          // Fallback: Direct DB save when queue fails (Redis OOM, connection error)
          dbLogger.warn({ err, documentName }, 'Queue unavailable, falling back to direct save')

          try {
            // Use transaction with FOR UPDATE lock to prevent race conditions
            // Multiple Hocuspocus instances may hit this fallback simultaneously
            await prisma.$transaction(async (tx) => {
              // Use raw query with FOR UPDATE to actually lock the row
              const existingDocs = await tx.$queryRaw<{ version: number }[]>`
                SELECT version FROM "Documents"
                WHERE "documentId" = ${documentName}
                ORDER BY id DESC
                LIMIT 1
                FOR UPDATE
              `
              const existingDoc = existingDocs[0] ?? null

              await tx.documents.create({
                data: {
                  documentId: documentName,
                  commitMessage: commitMessage || '',
                  version: existingDoc ? existingDoc.version + 1 : 1,
                  data: Buffer.from(stateBase64, 'base64')
                }
              })
            })

            dbLogger.info({ documentName }, 'Document saved via fallback (direct DB)')
          } catch (dbErr) {
            dbLogger.error(
              { err: dbErr, documentName },
              'Fallback save failed - document may be lost'
            )
            throw dbErr
          }
        }
      }
    })
  )

  extensions.push(healthCheck)

  // Add Redis subscriber for save confirmations (requires Redis)
  if (checkEnvBolean(process.env.REDIS)) {
    extensions.push(new RedisSubscriberExtension())
  }

  // Add document view tracking (requires Supabase)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    extensions.push(new DocumentViewsExtension())
    dbLogger.info('Document view tracking enabled')
  }

  return extensions
}

export default () => {
  return {
    name: getServerName(),
    port: parseInt(process.env.HOCUSPOCUS_PORT || '4001', 10),
    extensions: configureExtensions(),
    debounce: 10_000, // 10 seconds - wait for user to stop typing
    maxDebounce: 60_000, // 60 seconds - force save even if user keeps typing (prevents data loss)

    async onListen(data: any) {
      healthCheck.onConfigure({ ...data, extensions: configureExtensions() })
    },

    onRequest(data: any) {
      return new Promise((resolve, reject) => {
        const { request, response } = data

        if (request.url === '/health') {
          const health = healthCheck.getHealth()
          response.writeHead(200, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify(health))
          return reject()
        }

        if (request.url === '/health/websocket') {
          const wsHealth = healthCheck.status.websocket
          response.writeHead(200, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify(wsHealth))
          return reject()
        }

        if (request.url === '/health/database') {
          const dbHealth = healthCheck.getDatabaseStatus()
          response.writeHead(200, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify(dbHealth))
          return reject()
        }

        if (request.url === '/health/redis') {
          const redisHealth = healthCheck.getRedisStatus()
          response.writeHead(200, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify(redisHealth))
          return reject()
        }

        resolve()
      })
    }
  }
}
