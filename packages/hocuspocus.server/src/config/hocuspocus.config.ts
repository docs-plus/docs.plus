import * as Y from 'yjs'
import { PrismaClient } from '@prisma/client'
import { Database } from '@hocuspocus/extension-database'
import { Throttle } from '@hocuspocus/extension-throttle'
import { Redis as RedisExtension } from '@hocuspocus/extension-redis'
import { Logger } from '@hocuspocus/extension-logger'
import { checkEnvBolean, generateRandomId } from '../utils'
import { StoreDocumentQueue } from '../lib/queue'
import { HealthCheck } from '../extensions/health.extension'

export { Database }

export const prisma = new PrismaClient()

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
    extensions.push(
      new RedisExtension({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10)
      })
    )
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
          console.error('Error fetching data:', err)
          await prisma.$disconnect()
          throw err
        }
      },

      async store(data: any) {
        const { documentName, state, context } = data
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, state)
        const meta = ydoc.getMap('metadata')
        const commitMessage = meta.get('commitMessage') || ''
        const isDraft = meta.get('isDraft') || false
        let firstCreation = false

        meta.delete('commitMessage')

        // If the document is draft, don't store the data
        if (isDraft) return

        if (meta.has('isDraft')) {
          meta.delete('isDraft')
          firstCreation = true
        }

        // Create a new Y.Doc to store the updated state
        Y.applyUpdate(ydoc, state)
        const newState = Y.encodeStateAsUpdate(ydoc)

        // Add job to queue
        await StoreDocumentQueue.add('store-document', {
          documentName,
          state: Buffer.from(newState).toString('base64'),
          context,
          commitMessage,
          firstCreation
        })
      }
    })
  )

  extensions.push(healthCheck)

  return extensions
}

export default () => {
  return {
    name: getServerName(),
    port: parseInt(process.env.HOCUSPOCUS_PORT || '3002', 10),
    extensions: configureExtensions(),
    debounce: 10_000, // 10 seconds

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
