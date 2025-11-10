import { Server } from '@hocuspocus/server'
import HocuspocusConfig from './config/hocuspocus.config'
import { prisma, shutdownDatabase } from './lib/prisma'
import { disconnectRedis } from './lib/redis'
import { verifyJWT, decodeJWT } from './utils'
import type { HistoryPayload } from './types'
import { logger } from './lib/logger'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Create logger for WebSocket server
const wsLogger = logger.child({ service: 'websocket' })

async function handleHistoryEvents(payload: HistoryPayload, context: any, document: any) {
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
  async onStateless({ payload, context, document, connection }: any) {
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
      return {
        user: null,
        slug: '',
        documentId: documentName
      }
    }

    try {
      const tokenData = JSON.parse(token)

      // Verify JWT signature if accessToken is provided
      if (tokenData.accessToken) {
        const verified = verifyJWT(tokenData.accessToken)

        if (verified) {
          wsLogger.debug({ userId: verified.sub, documentName }, 'JWT verified successfully')
          return {
            user: verified,
            slug: tokenData.slug || '',
            documentId: documentName
          }
        } else {
          wsLogger.warn({ documentName }, 'JWT verification failed - invalid signature')

          // In production, reject invalid tokens
          if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET) {
            throw new Error('Invalid authentication token')
          }

          // In development, allow access but log warning
          wsLogger.warn('Allowing unauthenticated access in development mode')
          return {
            user: null,
            slug: tokenData.slug || '',
            documentId: documentName
          }
        }
      }

      // No accessToken provided, allow access with slug only
      wsLogger.debug({ documentName }, 'No accessToken in token data')
      return {
        user: null,
        slug: tokenData.slug || '',
        documentId: documentName
      }
    } catch (error) {
      wsLogger.error({ err: error, documentName }, 'Error parsing authentication token')

      // In production, reject malformed tokens
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Malformed authentication token')
      }

      // In development, allow access
      return {
        user: null,
        slug: '',
        documentId: documentName
      }
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
