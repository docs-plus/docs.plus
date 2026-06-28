import './lib/instrument'
import './config/env' // validate env first (fail-fast at boot)

import type { Connection } from '@hocuspocus/server'
import { Server } from '@hocuspocus/server'

import HocuspocusConfig from './config/hocuspocus.config'
import { verifySupabaseToken } from './lib/auth'
import { handleHistoryStateless } from './lib/history-stateless'
import { captureException } from './lib/instrument'
import { logger } from './lib/logger'
import { prisma, shutdownDatabase } from './lib/prisma'
import { closeQueues } from './lib/queue'
import { disconnectRedis } from './lib/redis'
import type { HistoryPayload } from './types/document.types'

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
        captureException(error)
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

  async onAuthenticate({ token, documentName, connection }: any) {
    // The room id is the bare documentId. Resolve the user first, then deny
    // anonymous access to admin-set private documents at one choke point.
    const isProd = process.env.NODE_ENV === 'production'
    // Expired/invalid Supabase tokens on (re)connect are expected and high-volume:
    // reject them so the client refreshes, but don't capture them as errors.
    const INVALID_TOKEN_MESSAGE = 'Invalid authentication token'

    let user: Awaited<ReturnType<typeof verifySupabaseToken>> = null
    let slug = ''
    let deviceType = 'desktop'

    if (!token) {
      wsLogger.debug({ documentName }, 'No token provided - anonymous')
    } else {
      try {
        const tokenData = JSON.parse(token)
        slug = tokenData.slug || ''
        deviceType = tokenData.deviceType || 'desktop'

        if (tokenData.accessToken) {
          user = await verifySupabaseToken(tokenData.accessToken)
          if (user) {
            wsLogger.debug({ userId: user.sub, documentName }, 'Token verified')
          } else if (isProd) {
            throw new Error(INVALID_TOKEN_MESSAGE)
          } else {
            wsLogger.warn({ documentName }, 'Token verification failed - allowing in dev')
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message === INVALID_TOKEN_MESSAGE) {
          // Expected rejection (expired/invalid token): reject so the client
          // refreshes and reconnects; not an error to log at level 50 or capture.
          wsLogger.info({ documentName }, 'Rejecting invalid/expired token')
          if (isProd) throw error
        } else {
          wsLogger.error({ err: error, documentName }, 'Auth error')
          captureException(error)
          if (isProd) throw new Error('Authentication failed', { cause: error })
        }
        user = null
        slug = ''
        deviceType = 'desktop'
      }
    }

    // Privacy is read authoritatively from the DB (never trust the client). A DB
    // lookup failure fails open so a blip can't sever all collaboration; private
    // docs are admin-set and rare. is_anonymous sessions count as anonymous here.
    let isPrivate = false
    let readOnly = false
    let ownerId: string | null = null
    try {
      const meta = await prisma.documentMetadata.findUnique({
        where: { documentId: documentName },
        select: { isPrivate: true, readOnly: true, ownerId: true }
      })
      isPrivate = meta?.isPrivate === true
      readOnly = meta?.readOnly === true
      ownerId = meta?.ownerId ?? null
    } catch (error) {
      wsLogger.warn({ err: error, documentName }, 'Private-doc lookup failed; allowing connection')
    }

    if (isPrivate && (!user || user.is_anonymous)) {
      throw new Error('Authentication required for private document')
    }

    // Enforce the admin readOnly lock on the WRITE path. The client editor honors it,
    // but a raw WS client could otherwise write; owners keep edit rights.
    if (readOnly && connection && user?.sub !== ownerId) {
      connection.readOnly = true
    }

    return { user, slug, documentId: documentName, deviceType }
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

    await closeQueues()
    await shutdownDatabase()
    await disconnectRedis()

    wsLogger.info('✅ WebSocket server shutdown complete')
    process.exit(0)
  } catch (err) {
    wsLogger.error({ err }, '❌ Error during shutdown')
    captureException(err)
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

process.on('unhandledRejection', (reason) => {
  wsLogger.error({ err: reason }, 'Unhandled promise rejection')
})
process.on('uncaughtException', (err) => {
  wsLogger.error({ err }, 'Uncaught exception — shutting down')
  void shutdown()
})
