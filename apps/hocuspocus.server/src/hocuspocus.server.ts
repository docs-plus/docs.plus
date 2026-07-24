import './lib/instrument'
import './config/env' // validate env first (fail-fast at boot)

import type { Connection, onAuthenticatePayload } from '@hocuspocus/server'
import { Server } from '@hocuspocus/server'

import { ensureDraftDocumentMetadata } from './api/services/documents.service'
import HocuspocusConfig from './config/hocuspocus.config'
import { type SupabaseUser, verifySupabaseTokenOutcome } from './lib/auth'
import { handleHistoryStateless } from './lib/history-stateless'
import { captureUnknown, flushObservability } from './lib/instrument'
import { wsLogger } from './lib/logger'
import {
  documentLoadDuration,
  documentPersistDuration,
  metricsContentType,
  metricsText,
  setActiveConnectionsProvider,
  setActiveDocumentsProvider,
  wsAuthRejectionsTotal,
  wsAwarenessUpdatesTotal,
  wsConnectionsTotal,
  wsMessagesTotal,
  ydocUpdateBytes
} from './lib/metrics'
import { prisma, shutdownDatabase } from './lib/prisma'
import { closeQueues, refreshPendingStateKeyTtls } from './lib/queue'
import { disconnectRedis } from './lib/redis'
import { resolveWsAccess } from './lib/wsAccess'
import type { HistoryPayload } from './types/document.types'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Bracket load/store hooks keyed by the Document object; WeakMap means an aborted
// load that never reaches the `after` hook is GC'd instead of leaking a timer.
const loadStartedAt = new WeakMap<object, number>()
const storeStartedAt = new WeakMap<object, number>()

// Anchor a draft's slug->documentId row exactly once per loaded doc; keyed by the
// Document object so it GC's on unload (no manual cleanup, no unbounded growth).
const draftMetadataEnsured = new WeakSet<object>()

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
        version: parsedPayload.version
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

// First-edit identity anchor: the instant isDraft flips false (real edit intent),
// create the slug->documentId metadata row so a reload's slug lookup resolves to
// the SAME (random) documentId — the stable IndexedDB key + WS room name that let
// the client mirror restore early edits before the debounced content store() lands.
// Bots that open and never edit keep isDraft and stay row-less (anti-empty-doc).
const firstEditMetadataExtension = {
  async onChange({
    document,
    documentName,
    context
  }: {
    document: { getMap: (name: string) => { get: (key: string) => unknown } }
    documentName: string
    context?: { slug?: string; user?: { sub?: string; email?: string } | null }
  }) {
    if (draftMetadataEnsured.has(document)) return
    if (document.getMap('metadata').get('isDraft')) return
    // Resolve the slug BEFORE claiming the once-guard: a slugless edit (a raw WS
    // client / dev token-parse edge — the webapp always sends one) must not poison
    // the guard, or a later slug-bearing edit on this doc could never anchor.
    const slug = context?.slug ?? ''
    if (!slug) return
    draftMetadataEnsured.add(document)
    try {
      await ensureDraftDocumentMetadata(prisma, {
        documentId: documentName,
        slug,
        ownerId: context?.user?.sub ?? null,
        email: context?.user?.email ?? null
      })
    } catch (err) {
      wsLogger.warn({ err, documentName }, 'First-edit metadata anchor failed')
    }
  }
}

const baseConfig = HocuspocusConfig()
const serverConfig = {
  ...baseConfig,
  extensions: [
    ...baseConfig.extensions,
    metricsExtension,
    statelessExtension,
    firstEditMetadataExtension
  ],

  async onConnect() {
    wsConnectionsTotal.inc()
  },

  async onAuthenticate({ token, documentName, connectionConfig }: onAuthenticatePayload) {
    // The room id is the bare documentId. Resolve the user first, then deny
    // anonymous access to admin-set private documents at one choke point.
    const isProd = process.env.NODE_ENV === 'production'
    // Expired/invalid Supabase tokens on (re)connect are expected and high-volume:
    // reject them so the client refreshes, but don't capture them as errors.
    const INVALID_TOKEN_MESSAGE = 'Invalid authentication token'

    let user: SupabaseUser | null = null
    let slug = ''
    let deviceType = 'desktop'

    if (!token) {
      wsLogger.debug({ documentName }, 'No token provided - anonymous')
    } else {
      let tokenData: { slug?: string; deviceType?: string; accessToken?: string }
      try {
        tokenData = JSON.parse(token)
        slug = tokenData.slug || ''
        deviceType = tokenData.deviceType || 'desktop'
      } catch (error) {
        wsLogger.error({ err: error, documentName }, 'Auth error')
        captureUnknown(error)
        if (isProd) throw new Error('Authentication failed', { cause: error })
        user = null
        slug = ''
        deviceType = 'desktop'
        tokenData = {}
      }

      if (tokenData.accessToken) {
        const outcome = await verifySupabaseTokenOutcome(tokenData.accessToken)
        switch (outcome.kind) {
          case 'user':
            user = outcome.user
            wsLogger.debug({ userId: user.sub, documentName }, 'Token verified')
            break
          case 'unavailable':
            // Keep slug/deviceType — only identity degrades to anonymous so a
            // transient auth outage cannot mint the wrong first-save slug.
            wsLogger.warn({ documentName }, 'Transient auth failure - degrading to anonymous')
            user = null
            break
          case 'invalid':
            user = null
            if (isProd) {
              wsLogger.info({ documentName }, 'Rejecting invalid/expired token')
              wsAuthRejectionsTotal.inc()
              throw new Error(INVALID_TOKEN_MESSAGE)
            }
            wsLogger.warn({ documentName }, 'Token verification failed - allowing in dev')
            break
          default: {
            const _exhaustive: never = outcome
            return _exhaustive
          }
        }
      }
    }

    // Privacy is read authoritatively from the DB (never trust the client). "Private"
    // means owner-only; anonymous and signed-in non-owners are rejected. A failed
    // lookup can't determine privacy, so we fail CLOSED (deny) rather than admit as
    // public; a successful public-doc lookup still connects without auth.
    let isPrivate = false
    let readOnly = false
    let ownerId: string | null = null
    let lookupFailed = false
    // Declared outside the try so a lookup throw leaves it false and `lookupFailed`
    // (not a stale default) drives the fail-closed deny — the audit-#1 bug shape.
    let deleted = false
    try {
      const meta = await prisma.documentMetadata.findUnique({
        where: { documentId: documentName },
        select: { isPrivate: true, readOnly: true, ownerId: true, deletedAt: true }
      })
      isPrivate = meta?.isPrivate === true
      readOnly = meta?.readOnly === true
      ownerId = meta?.ownerId ?? null
      deleted = meta?.deletedAt != null
    } catch (error) {
      lookupFailed = true
      wsLogger.warn({ err: error, documentName }, 'Private-doc lookup failed; denying connection')
    }

    if (resolveWsAccess({ isPrivate, ownerId, user, lookupFailed, deleted }) === 'deny') {
      wsLogger.info(
        { documentName, hasUser: Boolean(user), lookupFailed, deleted },
        'Denying WS connection to private/deleted/uncertain document'
      )
      throw new Error('Access denied for private document')
    }

    // Enforce the admin readOnly lock on the WRITE path. The client editor
    // honors it, but a raw WS client could otherwise write; owners keep edit
    // rights. v3 renamed the payload field: connectionConfig, NOT connection.
    if (readOnly && user?.sub !== ownerId) {
      connectionConfig.readOnly = true
    }

    return { user, slug, documentId: documentName, deviceType }
  }
}

const server = new Server(serverConfig)

// Read live counts at scrape time rather than tracking inc/dec, which would
// drift up forever (a load that failed before unload; a connection rejected
// pre-auth whose onDisconnect never fires). Auth-rejected sockets never attach
// to a document, so summing per-document connections counts only real ones.
setActiveDocumentsProvider(() => server.hocuspocus.documents.size)
setActiveConnectionsProvider(() =>
  [...server.hocuspocus.documents.values()].reduce((sum, doc) => sum + doc.getConnectionsCount(), 0)
)

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

// Producer-side because enqueue lives here: keeps stranded claim-check
// payloads alive while their jobs wait out a worker outage (queue.ts
// refreshPendingStateKeyTtls). 10 min against the 1h TTL leaves wide margin.
const STATE_KEY_TTL_REFRESH_INTERVAL_MS = 10 * 60 * 1000
const stateKeyTtlRefresh = setInterval(() => {
  refreshPendingStateKeyTtls()
    .then((refreshed) => {
      if (refreshed > 0) wsLogger.info({ refreshed }, 'Re-armed pending store-job state-key TTLs')
    })
    .catch((err) => wsLogger.warn({ err }, 'State-key TTL refresh failed'))
}, STATE_KEY_TTL_REFRESH_INTERVAL_MS)

const shutdown = async () => {
  wsLogger.info('Shutting down WebSocket server gracefully...')

  try {
    clearInterval(stateKeyTtlRefresh)
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
