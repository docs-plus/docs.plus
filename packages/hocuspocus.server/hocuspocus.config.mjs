import express from 'express'
import * as Y from 'yjs'
import cryptoRandomString from 'crypto-random-string'
import { PrismaClient } from '@prisma/client'
import { Database } from '@hocuspocus/extension-database'
import { Throttle } from '@hocuspocus/extension-throttle'
import { Redis } from '@hocuspocus/extension-redis'
import { Logger } from '@hocuspocus/extension-logger'
import { checkEnvBolean } from './utils/index.mjs'
import Queue from 'bull'
import { HealthCheck } from './extensions/health.extension.mjs'
import { Server } from 'http'
export { Database }

export const prisma = new PrismaClient()

const StoreDocument = new Queue('store documents changes', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  limiter: {
    max: 300,
    duration: 1000
  }
})

StoreDocument.process(async function (job, done) {
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
          slug: data.context.slug,
          title: data.context.slug,
          description: data.context.slug,
          ownerId: context.user?.sub,
          email: context.user?.email,
          keywords: ''
        },
        create: {
          documentId: data.documentName,
          slug: data.context.slug,
          title: data.context.slug,
          description: data.context.slug,
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
    return await prisma.documents.create({
      data: {
        documentId: data.documentName,
        commitMessage: data.commitMessage,
        version: currentDoc ? currentDoc.version + 1 : 1,
        data: Buffer.from(data.state, 'base64')
      }
    })
  } catch (err) {
    console.error('Error storing data:', err)
  } finally {
    console.timeEnd(`Store Data, jobId:${job.id}`)
    done()
  }
})

const getServerName = () =>
  `${process.env.APP_NAME}_${cryptoRandomString({
    length: 4,
    type: 'alphanumeric'
  })}`

const generateDefaultState = () => {
  const ydoc = new Y.Doc()
  const ymeta = ydoc.getMap('metadata')
  ymeta.set('needsInitialization', true)
  ymeta.set('isDraft', true)
  return Y.encodeStateAsUpdate(ydoc)
}

const healthCheck = new HealthCheck()

const configureExtensions = () => {
  const extensions = []

  if (checkEnvBolean(process.env.HOCUSPOCUS_THROTTLE)) {
    extensions.push(
      new Throttle({
        throttle: +process.env.HOCUSPOCUS_THROTTLE_ATTEMPTS,
        banTime: +process.env.HOCUSPOCUS_THROTTLE_BANTIME
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
      new Redis({
        host: process.env.REDIS_HOST,
        port: +process.env.REDIS_PORT
      })
    )
  }

  extensions.push(
    new Database({
      async fetchDocument(documentName) {
        const data = await this.fetch({ documentName })
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, data)
        return ydoc
      },

      async storeDocument(documentName, update) {
        await this.store({
          documentName,
          state: update,
          context: {} // Add any needed context
        })
      },
      fetch: async ({ documentName, context }) => {
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
      store: async (data) => {
        const { documentName, state, context } = data
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, data.state)
        const meta = ydoc.getMap('metadata')
        const commitMessage = meta.get('commitMessage') || ''
        const isDraft = meta.get('isDraft') || false
        let firstCreation = false

        meta.delete('commitMessage')
        // if the document is draft, don't store the data
        // draft will change in client side
        if (isDraft) return
        if (meta.has('isDraft')) {
          meta.delete('isDraft')
          firstCreation = true
        }

        // Create a new Y.Doc to store the updated state
        Y.applyUpdate(ydoc, state)
        const newState = Y.encodeStateAsUpdate(ydoc)

        const doooyy = new Y.Doc()
        Y.applyUpdate(doooyy, newState)

        StoreDocument.add({
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
  const app = express()
  const httpServer = new Server(app)

  return {
    name: getServerName(),
    port: process.env.HOCUSPOCUS_PORT,
    extensions: configureExtensions(),
    debounce: 10 * 1000, // 10 seconds
    server: httpServer,
    async onListen(data) {
      healthCheck.onConfigure({ ...data, extensions: configureExtensions() })
    },

    onRequest(data) {
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
