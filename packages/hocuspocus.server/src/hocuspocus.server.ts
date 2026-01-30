import { Server } from '@hocuspocus/server'

import HocuspocusConfig from './config/hocuspocus.config'
import { logger } from './lib/logger'
import { prisma, shutdownDatabase } from './lib/prisma'
import { disconnectRedis } from './lib/redis'
import type { HistoryPayload } from './types'
import { verifyJWT } from './utils'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Create logger for WebSocket server
const wsLogger = logger.child({ service: 'websocket' })

async function handleHistoryEvents(payload: HistoryPayload, _context: any, _document: any) {
  const { type, documentId } = payload

  switch (type) {
    case 'history.list': {
      const docs = await prisma.documents.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        select: { version: true, commitMessage: true, createdAt: true }
      })
      return docs
    }

    case 'history.watch': {
      const doc = await prisma.documents.findFirst({
        where: { documentId, version: payload.version },
        select: { data: true, version: true, commitMessage: true, createdAt: true }
      })

      if (!doc) return null

      // Convert Buffer to Base64 string for transport
      return {
        data: Buffer.from(doc.data).toString('base64'),
        version: doc.version,
        commitMessage: doc.commitMessage,
        createdAt: doc.createdAt
      }
    }

    case 'history.prev':
      return prisma.documents.findFirst({
        where: { documentId, version: { lt: payload.currentVersion || 0 } },
        orderBy: { version: 'desc' }
      })

    case 'history.next':
      return prisma.documents.findFirst({
        where: { documentId, version: { gt: payload.currentVersion || 0 } },
        orderBy: { version: 'asc' }
      })

    default:
      return payload
  }
}

const broadcastToAll = (document: any, payload: any) => {
  document.broadcastStateless(JSON.stringify(payload))
}

const statelessExtension = {
  async onStateless({ payload, context, document, _connection }: any) {
    const parsedPayload = JSON.parse(payload)

    if (parsedPayload.msg === 'history') {
      try {
        const response = await handleHistoryEvents(parsedPayload, context, document)
        broadcastToAll(document, {
          msg: 'history.response',
          type: parsedPayload.type,
          response
        })
      } catch (error) {
        wsLogger.error({ err: error }, 'Error handling history event')
      }
    } else {
      document.broadcastStateless(JSON.stringify(parsedPayload))
    }
  }
}

// Get the base configuration and add our stateless extension
const baseConfig = HocuspocusConfig()
const serverConfig = {
  ...baseConfig,
  extensions: [...baseConfig.extensions, statelessExtension],

  async onAuthenticate({ token, documentName }: any) {
    if (!token) {
      wsLogger.debug({ documentName }, 'No token provided - allowing anonymous access')
      return { user: null, slug: '', documentId: documentName, deviceType: 'desktop' }
    }

    try {
      const tokenData = JSON.parse(token)
      // Extract deviceType from token (sent by webapp)
      const deviceType = tokenData.deviceType || 'desktop'

      if (tokenData.accessToken) {
        const user = await verifyJWT(tokenData.accessToken)

        if (user) {
          wsLogger.debug({ userId: user.sub, documentName }, 'Token verified')
          return { user, slug: tokenData.slug || '', documentId: documentName, deviceType }
        }

        // Token invalid
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Invalid authentication token')
        }

        wsLogger.warn({ documentName }, 'Token verification failed - allowing in dev')
        return { user: null, slug: tokenData.slug || '', documentId: documentName, deviceType }
      }

      // No accessToken, allow with slug only
      return { user: null, slug: tokenData.slug || '', documentId: documentName, deviceType }
    } catch (error) {
      wsLogger.error({ err: error, documentName }, 'Auth error')

      if (process.env.NODE_ENV === 'production') {
        throw new Error('Authentication failed')
      }

      return { user: null, slug: '', documentId: documentName, deviceType: 'desktop' }
    }
  }
}

// Configure and start the server
const server = new Server(serverConfig)

// Start listening
server.listen()

wsLogger.info({
  msg: '🚀 WebSocket Server started successfully',
  port: baseConfig.port,
  environment: process.env.NODE_ENV,
  url: `ws://localhost:${baseConfig.port}`
})

// Graceful shutdown
const shutdown = async () => {
  wsLogger.info('Shutting down WebSocket server gracefully...')

  try {
    await server.destroy()
    wsLogger.info('WebSocket server stopped')

    await shutdownDatabase()
    await disconnectRedis()

    wsLogger.info('✅ WebSocket server shutdown complete')
    process.exit(0)
  } catch (err) {
    wsLogger.error({ err }, '❌ Error during shutdown')
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
