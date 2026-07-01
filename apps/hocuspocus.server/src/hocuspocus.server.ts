import './lib/instrument'
import './config/env' // validate env first (fail-fast at boot)

import type { Connection } from '@hocuspocus/server'
import { Server } from '@hocuspocus/server'

import HocuspocusConfig from './config/hocuspocus.config'
import { verifySupabaseToken } from './lib/auth'
import { handleHistoryStateless } from './lib/history-stateless'
import { captureUnknown, flushObservability } from './lib/instrument'
import { wsLogger } from './lib/logger'
import {
  documentLoadDuration,
  documentPersistDuration,
  metricsContentType,
  metricsText,
  setActiveDocumentsProvider,
  wsActiveConnections,
  wsAuthRejectionsTotal,
  wsAwarenessUpdatesTotal,
  wsConnectionsTotal,
  wsMessagesTotal,
  ydocUpdateBytes
} from './lib/metrics'
import { prisma, shutdownDatabase } from './lib/prisma'
import { closeQueues } from './lib/queue'
import { disconnectRedis } from './lib/redis'
import type { HistoryPayload } from './types/document.types'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Bracket load/store hooks keyed by the Document object; WeakMap means an aborted
// load that never reaches the `after` hook is GC'd instead of leaking a timer.
const loadStartedAt = new WeakMap<object, number>()
const storeStartedAt = new WeakMap<object, number>()

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

// High priority so the load/store START timers run BEFORE the Database extension's
// own onLoadDocument/onStoreDocument (priority sort: higher runs first). Otherwise
// the bracket would begin AFTER the prisma fetch / enqueue and observe ≈0.
const metricsExtension = {
  priority: 1000,

  async onLoadDocument({ document }: { document: object }) {
    loadStartedAt.set(document, Date.now())
  },

  async afterLoadDocument({ document }: { document: object }) {
    const started = loadStartedAt.get(document)
    if (started === undefined) return
    documentLoadDuration.observe((Date.now() - started) / 1000)
    loadStartedAt.delete(document)
  },

  async onStoreDocument({ document }: { document: object }) {
    storeStartedAt.set(document, Date.now())
  },

  async afterStoreDocument({ document }: { document: object }) {
    const started = storeStartedAt.get(document)
    if (started === undefined) return
    documentPersistDuration.observe((Date.now() - started) / 1000)
    storeStartedAt.delete(document)
  },

  async onChange({ update }: { update: Uint8Array }) {
    ydocUpdateBytes.observe(update.byteLength)
  },

  // Inbound sync messages are exactly 1:1 with this hook (verified at MessageReceiver).
  async beforeSync() {
    wsMessagesTotal.inc({ type: 'sync' })
  },

  async onAwarenessUpdate() {
    wsAwarenessUpdatesTotal.inc()
    wsMessagesTotal.inc({ type: 'awareness' })
  }
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
    wsMessagesTotal.inc({ type: 'stateless' })

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
        captureUnknown(error)
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
  extensions: [...baseConfig.extensions, metricsExtension, statelessExtension],

  async onConnect() {
    wsConnectionsTotal.inc()
    wsActiveConnections.inc()
  },

  async onDisconnect() {
    wsActiveConnections.dec()
  },

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
          wsAuthRejectionsTotal.inc()
          if (isProd) throw error
        } else {
          wsLogger.error({ err: error, documentName }, 'Auth error')
          captureUnknown(error)
          if (isProd) throw new Error('Authentication failed', { cause: error })
        }
        user = null
        slug = ''
        deviceType = 'desktop'
      }
    }

    // Privacy is read authoritatively from the DB (never trust the client). "Private"
    // means login-required ONLY (any non-anonymous user) -- NOT member-scoped by
    // design; the DocumentUsers/Role schema is unused legacy. Lookup fails open so a
    // blip can't sever collaboration; private docs are admin-set and rare.
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

// Read the live loaded-document count at scrape time rather than tracking inc/dec,
// which would drift up forever if a load failed before its unload.
setActiveDocumentsProvider(() => server.hocuspocus.documents.size)

server.listen()

wsLogger.info({
  msg: '🚀 WebSocket Server started successfully',
  port: baseConfig.port,
  environment: process.env.NODE_ENV,
  url: `ws://localhost:${baseConfig.port}`
})

// Prometheus scrape target on a dedicated internal port (NOT 4001 — that's the WS
// server's own port; a second listener there is a fatal EADDRINUSE). Off the Traefik route.
const METRICS_PORT = 4003
const metricsServer = Bun.serve({
  port: METRICS_PORT,
  hostname: '0.0.0.0',
  async fetch(req) {
    if (new URL(req.url).pathname !== '/metrics') return new Response('Not found', { status: 404 })
    return new Response(await metricsText(), { headers: { 'Content-Type': metricsContentType } })
  }
})

wsLogger.info({
  msg: '📊 Metrics server started',
  port: metricsServer.port,
  url: `http://localhost:${metricsServer.port}/metrics`
})

const shutdown = async () => {
  wsLogger.info('Shutting down WebSocket server gracefully...')

  try {
    metricsServer.stop()
    await server.destroy()
    wsLogger.info('WebSocket server stopped')

    await closeQueues()
    await shutdownDatabase()
    await disconnectRedis()

    wsLogger.info('✅ WebSocket server shutdown complete')
    await flushObservability()
    process.exit(0)
  } catch (err) {
    wsLogger.error({ err }, '❌ Error during shutdown')
    captureUnknown(err)
    await flushObservability()
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

process.on('unhandledRejection', (reason) => {
  wsLogger.error({ err: reason }, 'Unhandled promise rejection')
  captureUnknown(reason)
})
process.on('uncaughtException', (err) => {
  wsLogger.error({ err }, 'Uncaught exception — shutting down')
  captureUnknown(err)
  void shutdown()
})
