import './lib/instrument'
import './config/env' // validate env first (fail-fast at boot)

import type {
  beforeHandleMessagePayload,
  Connection,
  onAuthenticatePayload
} from '@hocuspocus/server'
import { IncomingMessage, MessageType, Server } from '@hocuspocus/server'
import { Hono } from 'hono'

import { ensureDraftDocumentMetadata } from './api/services/documents.service'
import { config } from './config/env'
import HocuspocusConfig from './config/hocuspocus.config'
import { clientAuthorsExtension } from './extensions/client-authors.extension'
import { contributorsExtension } from './extensions/contributors.extension'
import { type SupabaseUser, verifyServiceRole, verifySupabaseTokenOutcome } from './lib/auth'
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
  statelessRelayDroppedTotal,
  wsAuthRejectionsTotal,
  wsAwarenessUpdatesTotal,
  wsConnectionsTotal,
  wsMessagesTotal,
  ydocUpdateBytes
} from './lib/metrics'
import { prisma, shutdownDatabase } from './lib/prisma'
import { closeQueues, refreshPendingStateKeyTtls, stripSnapshotMetadata } from './lib/queue'
import { disconnectRedis } from './lib/redis'
import { resolveWsAccess } from './lib/wsAccess'
import * as documentContent from './modules/document-content'
import type { RevertOutcome, VersionFailureReason, VersionOps } from './modules/document-versions'
import * as documentVersions from './modules/document-versions'
import { MAX_VERSION_NUMBER } from './modules/document-versions/types'
import type { HistoryPayload } from './types/document.types'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

// Bracket load/store hooks keyed by the Document object. WeakMap means an aborted
// load that never reaches the `after` hook is GC'd instead of leaking a timer.
const loadStartedAt = new WeakMap<object, number>()
const storeStartedAt = new WeakMap<object, number>()

// Anchor a draft's slug->documentId row exactly once per loaded doc. The key is
// the Document object, so the entry GC's on unload (no manual cleanup, no
// unbounded growth).
const draftMetadataEnsured = new WeakSet<object>()

const HISTORY_FAILED = 'history_failed'

/** `error` stays the bare literal every client already branches on; `reason` is additive. */
type HistoryFailure = { error: typeof HISTORY_FAILED; reason?: VersionFailureReason }

function sendHistoryResponse(
  connection: Connection,
  type: string,
  response: unknown,
  failure?: HistoryFailure
) {
  connection.sendStateless(
    JSON.stringify({
      msg: 'history.response',
      type,
      response,
      ...(failure
        ? { error: failure.error, ...(failure.reason && { reason: failure.reason }) }
        : {})
    })
  )
}

// The ops need the Hocuspocus instance. That instance does not exist until the
// server is constructed from a config that already captured this extension.
// Hence a late ref rather than a closure.
let versionOps: VersionOps | null = null

const REVERT_TYPE = 'history.revert'
const LIST_TYPE = 'history.list'

// A revert runs six whole-document traversals on this event loop and appends a
// permanent backup row. Unlike its REST twin, a revert is reachable by any
// signed-in client — including the anonymous session every visitor gets.
// `Throttle` only covers onConnect, so the cooldown lives here.
const REVERT_COOLDOWN_MS = 2000
const REVERT_COOLDOWN_MAX_KEYS = 10_000
const lastRevertAt = new Map<string, number>()

const revertCoolingDown = (documentId: string, now: number): boolean => {
  const previous = lastRevertAt.get(documentId)
  if (previous !== undefined && now - previous < REVERT_COOLDOWN_MS) return true
  // Bounded without a timer: sweep expired keys only once the map is large.
  if (lastRevertAt.size >= REVERT_COOLDOWN_MAX_KEYS) {
    for (const [key, at] of lastRevertAt) {
      if (now - at >= REVERT_COOLDOWN_MS) lastRevertAt.delete(key)
    }
  }
  lastRevertAt.set(documentId, now)
  return false
}

// `history.list` reads every version row plus the base64 head, and the same
// unauthenticated frame can be looped. Keyed per CONNECTION, not per document: a
// per-document key would let one visitor's refresh blank every other viewer's.
// Short enough that no remount can trip it — the client never retries a refusal.
const LIST_COOLDOWN_MS = 250
const lastListAt = new WeakMap<Connection, number>()

const listCoolingDown = (connection: Connection, now: number): boolean => {
  const previous = lastListAt.get(connection)
  if (previous !== undefined && now - previous < LIST_COOLDOWN_MS) return true
  lastListAt.set(connection, now)
  return false
}

async function handleHistoryRevert(
  connection: Connection,
  documentId: string,
  version: unknown
): Promise<void> {
  const refuse = (reason: VersionFailureReason) =>
    sendHistoryResponse(connection, REVERT_TYPE, null, { error: HISTORY_FAILED, reason })

  // Both gates live here because a DirectConnection write never passes through
  // MessageReceiver, where the readOnly drop is enforced. A viewer that reached
  // this op would otherwise rewrite the whole document with full privileges.
  const actorId: unknown = connection.context?.user?.sub
  if (typeof actorId !== 'string' || !actorId) return refuse('unauthorized')
  if (connection.readOnly !== false) return refuse('read-only')

  // `Documents.version` is int4: an out-of-range number would throw out of the
  // op before its own error handling and read back as a wedged persister.
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > MAX_VERSION_NUMBER
  ) {
    return refuse('not-found')
  }

  // After validation so a malformed flood cannot burn the document's only slot,
  // and before the ops so a real flood never reaches the traversals.
  if (revertCoolingDown(documentId, Date.now())) return refuse('rate-limited')

  if (!versionOps) {
    wsLogger.error({ documentId }, 'history.revert arrived before version ops were wired')
    sendHistoryResponse(connection, REVERT_TYPE, null, { error: HISTORY_FAILED })
    return
  }

  let outcome: RevertOutcome
  try {
    outcome = await versionOps.revertOp(documentId, version, { actorId })
  } catch (error) {
    wsLogger.error({ err: error, documentId, version }, 'history.revert threw')
    captureUnknown(error)
    return refuse('persist-failed')
  }

  if (outcome.status !== 'reverted') {
    wsLogger.warn({ documentId, version, status: outcome.status }, 'history.revert refused')
    return refuse(documentVersions.versionFailureReason(outcome))
  }

  sendHistoryResponse(connection, REVERT_TYPE, {
    restoredFrom: outcome.restoredFrom,
    backupVersion: outcome.backupVersion
  })
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

// The relay arm below mints one OutgoingMessage per connection. The arm is
// reachable with no credentials on any public room, so room size × burst rate
// is what OOM-kills a replica. The only client traffic here is `docTitle`, a
// metadata row that measures a few hundred bytes.
const MAX_STATELESS_RELAY_BYTES = 64 * 1024

// The relay has no authz, so a client-chosen envelope is a client-chosen server
// event. The webapp follows `type:'private'` into a hard redirect, and `msg` into
// a "Saved" status it reads before any type. `docTitle` is the only envelope a
// shipped client originates; every real server event broadcasts directly, not here.
const RELAYABLE_STATELESS_TYPES = new Set(['docTitle'])

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
        if (type) sendHistoryResponse(connection, type, null, { error: HISTORY_FAILED })
        return
      }

      if (parsedPayload.documentId != null && parsedPayload.documentId !== canonicalId) {
        wsLogger.warn(
          { clientDocumentId: parsedPayload.documentId, canonicalId },
          'history stateless documentId does not match connection room'
        )
        sendHistoryResponse(connection, type, null, { error: HISTORY_FAILED })
        return
      }

      // Handled ahead of the read ops: they share the envelope but not the
      // dispatch, whose default arm echoes an unknown type back as a success.
      if (type === REVERT_TYPE) {
        await handleHistoryRevert(connection, canonicalId, parsedPayload.version)
        return
      }

      // Only the list is gated, because `history.watch` reads one indexed row.
      // The client answers a refused watch by evicting that version and asking
      // for the next one. A cooldown there would therefore walk the client
      // through its own list.
      if (type === LIST_TYPE && listCoolingDown(connection, Date.now())) {
        sendHistoryResponse(connection, type, null, {
          error: HISTORY_FAILED,
          reason: 'rate-limited'
        })
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
        sendHistoryResponse(connection, type, null, { error: HISTORY_FAILED })
      }
      return
    }

    // Ahead of the stringify, so a refused payload is never serialised and an
    // oversized forgery counts as a forgery instead of muddying the OOM signal.
    // `msg` is refused outright: the named branches above own every legitimate one.
    if (
      parsedPayload.msg ||
      !parsedPayload.type ||
      !RELAYABLE_STATELESS_TYPES.has(parsedPayload.type)
    ) {
      statelessRelayDroppedTotal.inc({ reason: 'type-not-allowed' })
      wsLogger.warn(
        { documentName: document.name, type: String(parsedPayload.type).slice(0, 64) },
        'Refused stateless relay of a non-relayable envelope'
      )
      return
    }

    const relay = JSON.stringify(parsedPayload)
    const relayBytes = Buffer.byteLength(relay)
    if (relayBytes > MAX_STATELESS_RELAY_BYTES) {
      statelessRelayDroppedTotal.inc({ reason: 'oversized' })
      wsLogger.warn(
        { documentName: document.name, relayBytes, limit: MAX_STATELESS_RELAY_BYTES },
        'Dropped oversized stateless relay payload'
      )
      return
    }

    document.broadcastStateless(relay)
  },

  // Type 6 never reaches onStateless: MessageReceiver relays it to every room
  // connection inline, so the allowlist above cannot see it. Rejecting here drops
  // this document connection (a CLOSE frame, not the socket) — safe only because
  // @hocuspocus/provider's MessageType has no 6, so nothing shipped sends one.
  async beforeHandleMessage({ update, documentName, socketId }: beforeHandleMessagePayload) {
    let type: number
    try {
      const message = new IncomingMessage(update)
      message.readVarString()
      type = message.readVarUint()
    } catch {
      return // a truncated frame stays the library's error path, not a new one
    }
    if (type !== MessageType.BroadcastStateless) return

    statelessRelayDroppedTotal.inc({ reason: 'broadcast-frame' })
    wsLogger.warn({ documentName, socketId }, 'Refused a client BroadcastStateless frame')
    throw Object.assign(new Error('BroadcastStateless is not accepted from clients'), {
      reason: 'stateless-broadcast-refused'
    })
  }
}

// First-edit identity anchor: when isDraft flips false, write the slug→documentId
// row so a reload resolves the same IndexedDB key + room. Bots that never edit
// stay row-less. Content still persists via the debounced store().
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
    // Resolve the slug BEFORE claiming the once-guard. A slugless edit (a raw WS
    // client / dev token-parse edge — the webapp always sends one) must not poison
    // the guard. Otherwise a later slug-bearing edit on this doc could never anchor.
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
    contributorsExtension,
    statelessExtension,
    // Must follow firstEditMetadataExtension: both act on the update that clears
    // isDraft, and the awaited chain anchors the metadata row the binding needs.
    firstEditMetadataExtension,
    clientAuthorsExtension
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
              wsAuthRejectionsTotal.inc({ reason: 'invalid-token' })
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
    let purged = false
    try {
      const meta = await prisma.documentMetadata.findUnique({
        where: { documentId: documentName },
        select: { isPrivate: true, readOnly: true, ownerId: true, deletedAt: true }
      })
      isPrivate = meta?.isPrivate === true
      readOnly = meta?.readOnly === true
      ownerId = meta?.ownerId ?? null
      // A purged document has no row, so without the tombstone this arm cannot tell it
      // from one that never existed. A tab that missed the close frame would reconnect
      // on the old id and sync its erased IndexedDB mirror back up. Only reached when
      // there is no row, so a live document still costs one query.
      purged =
        meta == null &&
        (await prisma.documentPurgeTombstone.findUnique({
          where: { documentId: documentName },
          select: { documentId: true }
        })) != null
      deleted = meta?.deletedAt != null || purged
    } catch (error) {
      lookupFailed = true
      wsLogger.warn({ err: error, documentName }, 'Private-doc lookup failed; denying connection')
    }

    if (resolveWsAccess({ isPrivate, ownerId, user, lookupFailed, deleted }) === 'deny') {
      // Same precedence as resolveWsAccess, so the label names the arm that denied.
      // `purged` splits out of `deleted` because a purged reconnect is a resurrection
      // attempt, not a visit to a trashed document.
      const reason = lookupFailed
        ? 'lookup-failed'
        : purged
          ? 'purged'
          : deleted
            ? 'deleted'
            : 'private'
      wsAuthRejectionsTotal.inc({ reason })
      wsLogger.info(
        { documentName, hasUser: Boolean(user), lookupFailed, deleted, purged },
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

// Read live counts at scrape time rather than tracking inc/dec. Inc/dec tracking
// would drift up forever (a load that failed before unload; a connection rejected
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

// Content injection and version ops both have to run where the live Y.Doc is, so
// the WS process serves their internal endpoints beside /metrics. REST reaches
// them over the docker network via HOCUSPOCUS_INTERNAL_URL; Traefik never routes
// this port.
const contentApply = documentContent.initWsApply({
  hocuspocus: server.hocuspocus,
  prisma,
  verifyServiceRole,
  logger: wsLogger.child({ module: 'document-content' })
})

const documentVersionOps = documentVersions.initWsOps({
  hocuspocus: server.hocuspocus,
  prisma,
  verifyServiceRole,
  logger: wsLogger.child({ module: 'document-versions' }),
  stripSnapshotMetadata
})
versionOps = documentVersionOps.ops

// Hono's route() copies a sub-app's routes but not its notFound handler. An
// unknown internal path would therefore fall to the framework default (plain
// text) unless the house envelope is re-declared on the parent.
const internalApp = new Hono()
internalApp.route('/', contentApply.app)
internalApp.route('/', documentVersionOps.app)
internalApp.notFound((c) =>
  c.json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } }, 404)
)

// Dedicated internal port (NOT 4001 — that's the WS server's own port; a second
// listener there is a fatal EADDRINUSE). Off the Traefik route.
const INTERNAL_HTTP_PORT = config.hocuspocus.internalHttpPort
let internalServer: ReturnType<typeof Bun.serve>
try {
  internalServer = Bun.serve({
    port: INTERNAL_HTTP_PORT,
    hostname: config.hocuspocus.internalHttpHost,
    async fetch(req) {
      // Stays ahead of the Hono dispatch: Prometheus scrapes this cross-container
      // and the parent app now answers everything else with a 404 envelope.
      if (new URL(req.url).pathname === '/metrics') {
        return new Response(await metricsText(), {
          headers: { 'Content-Type': metricsContentType }
        })
      }
      return internalApp.fetch(req)
    }
  })
} catch (err) {
  // This listener binds AFTER server.listen(), so a mis-set port kills the
  // process once :4001 is already up — say why rather than dying on a raw throw.
  wsLogger.error(
    { err, port: INTERNAL_HTTP_PORT, hostname: config.hocuspocus.internalHttpHost },
    '❌ Failed to bind the internal HTTP listener (metrics, content apply, version ops)'
  )
  throw err
}

wsLogger.info({
  msg: '📊 Internal HTTP server started (metrics, content apply, version ops)',
  port: internalServer.port,
  url: `http://localhost:${internalServer.port}/metrics`
})

// Producer-side because enqueue lives here. The refresh keeps stranded
// claim-check payloads alive while their jobs wait out a worker outage (queue.ts
// refreshPendingStateKeyTtls). A 10 min interval against the 1h TTL leaves wide
// margin.
const STATE_KEY_TTL_REFRESH_INTERVAL_MS = 10 * 60 * 1000
const stateKeyTtlRefresh = setInterval(() => {
  refreshPendingStateKeyTtls()
    .then((refreshed) => {
      if (refreshed > 0) wsLogger.info({ refreshed }, 'Re-armed pending store-job state-key TTLs')
    })
    .catch((err) => wsLogger.warn({ err }, 'State-key TTL refresh failed'))
}, STATE_KEY_TTL_REFRESH_INTERVAL_MS)

// server.destroy() waits for every room to unload, so one wedged room holds it
// past the 30s stop_grace_period. SIGKILL then takes the queue drain, the DB
// close and the Sentry flush with it. The 25s leaves the tail room to finish.
const SERVER_DESTROY_TIMEOUT_MS = 25_000

const shutdown = async () => {
  wsLogger.info('Shutting down WebSocket server gracefully...')

  try {
    clearInterval(stateKeyTtlRefresh)
    internalServer.stop()

    let destroyTimer: ReturnType<typeof setTimeout> | undefined
    // A rejection is caught here, not rethrown. The outer catch flushes Sentry
    // but skips the queue, DB and Redis close below — the tail this bound exists
    // to reach. A hang and a throw have to end the same way.
    const destroyFailed = await Promise.race([
      server
        .destroy()
        .then(() => null)
        .catch((err: unknown) => err ?? new Error('server.destroy() rejected')),
      new Promise<'timeout'>((resolve) => {
        destroyTimer = setTimeout(() => resolve('timeout'), SERVER_DESTROY_TIMEOUT_MS)
      })
    ])
    clearTimeout(destroyTimer)

    if (destroyFailed === 'timeout') {
      wsLogger.error(
        { timeoutMs: SERVER_DESTROY_TIMEOUT_MS },
        'WebSocket server did not stop in time — continuing shutdown so queues, DB and Sentry still close'
      )
    } else if (destroyFailed) {
      wsLogger.error(
        { err: destroyFailed },
        'WebSocket server stop threw — continuing shutdown so queues, DB and Sentry still close'
      )
      captureUnknown(destroyFailed)
    } else {
      wsLogger.info('WebSocket server stopped')
    }

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
