import type { Connection } from '@hocuspocus/server'
import { Server } from '@hocuspocus/server'

import HocuspocusConfig from './config/hocuspocus.config'
import { handleHistoryStateless } from './lib/history-stateless'
import { logger } from './lib/logger'
import { shutdownDatabase } from './lib/prisma'
import { disconnectRedis } from './lib/redis'
import type { HistoryPayload } from './types/document.types'
import { verifyJWT } from './utils'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const wsLogger = logger.child({ service: 'websocket' })

function sendHistoryResponse(
  connection: Connection,
  type: string,
  response: unknown,
  error?: string
) {
  connection.sendStateless(
    JSON.stringify({
      msg: 'history.response',
      type,
      response,
      ...(error ? { error } : {})
    })
  )
}

/** Hocuspocus document name === provider `name` / room id; never trust client `documentId` for Prisma. */
function roomDocumentId(document: { name?: string }): string | null {
  const n = document?.name
  return typeof n === 'string' && n.length > 0 ? n : null
}

const statelessExtension = {
  async onStateless({
    payload,
    connection,
    document
  }: {
    payload: string
    connection: Connection
    document: { name?: string; broadcastStateless: (p: string) => void }
  }) {
    let parsedPayload: {
      msg?: string
      type?: string
      documentId?: string
      version?: number
      currentVersion?: number
    }
    try {
      parsedPayload = JSON.parse(payload) as typeof parsedPayload
    } catch {
      return
    }

    if (parsedPayload.msg === 'history') {
      const canonicalId = roomDocumentId(document)
      const type = parsedPayload.type

      if (!canonicalId || !type) {
        wsLogger.warn(
          { parsedPayload, hasRoomName: Boolean(canonicalId) },
          'history stateless missing room or type'
        )
        if (type) sendHistoryResponse(connection, type, null, 'history_failed')
        return
      }

      if (parsedPayload.documentId != null && parsedPayload.documentId !== canonicalId) {
        wsLogger.warn(
          { clientDocumentId: parsedPayload.documentId, canonicalId },
          'history stateless documentId does not match connection room'
        )
        sendHistoryResponse(connection, type, null, 'history_failed')
        return
      }

      const historyPayload: HistoryPayload = {
        type,
        documentId: canonicalId,
        version: parsedPayload.version,
        currentVersion: parsedPayload.currentVersion
      }

      try {
        const response = await handleHistoryStateless(historyPayload)
        sendHistoryResponse(connection, type, response)
      } catch (error) {
        wsLogger.error({ err: error }, 'Error handling history event')
        sendHistoryResponse(connection, type, null, 'history_failed')
      }
      return
    }

    document.broadcastStateless(JSON.stringify(parsedPayload))
  }
}

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
      const deviceType = tokenData.deviceType || 'desktop'

      if (tokenData.accessToken) {
        const user = await verifyJWT(tokenData.accessToken)

        if (user) {
          wsLogger.debug({ userId: user.sub, documentName }, 'Token verified')
          return { user, slug: tokenData.slug || '', documentId: documentName, deviceType }
        }

        if (process.env.NODE_ENV === 'production') {
          throw new Error('Invalid authentication token')
        }

        wsLogger.warn({ documentName }, 'Token verification failed - allowing in dev')
        return { user: null, slug: tokenData.slug || '', documentId: documentName, deviceType }
      }

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

const server = new Server(serverConfig)

server.listen()

wsLogger.info({
  msg: '🚀 WebSocket Server started successfully',
  port: baseConfig.port,
  environment: process.env.NODE_ENV,
  url: `ws://localhost:${baseConfig.port}`
})

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
