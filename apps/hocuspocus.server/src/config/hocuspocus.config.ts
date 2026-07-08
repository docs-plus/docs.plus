import { Prisma } from '@prisma/client'
import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'
import { Database } from '@hocuspocus/extension-database'
import { Throttle } from '@hocuspocus/extension-throttle'
import { Redis as RedisExtension } from '@hocuspocus/extension-redis'
import { Logger } from '@hocuspocus/extension-logger'
import { checkEnvBoolean, generateRandomId } from '../utils'
import { config } from './env'
import { buildStoreJobId, enqueueStoreDocument, stripSnapshotMetadata } from '../lib/queue'
import { documentPersistFallbackTotal } from '../lib/metrics'
import { HealthCheck } from '../extensions/health.extension'
import { RedisSubscriberExtension } from '../extensions/redis-subscriber.extension'
import { DocumentViewsExtension } from '../extensions/document-views.extension'
import { prisma } from '../lib/prisma'
import { captureDegraded, captureUnknown } from '../lib/instrument'
import { dbLogger } from '../lib/logger'
import {
  hasLegacyMediaNodes,
  isOldSchema,
  renameMediaNodes,
  transformNestedToFlat
} from '../lib/schema-migration'
import { migrationExtensions } from '../lib/migration-extensions'

const getServerName = () => `${config.app.name}_${generateRandomId(4)}`

const generateDefaultState = () => {
  const ydoc = new Y.Doc()
  const ymeta = ydoc.getMap('metadata')
  ymeta.set('needsInitialization', true)
  ymeta.set('isDraft', true)
  return Y.encodeStateAsUpdate(ydoc)
}

const healthCheck = new HealthCheck()

// A rebuilt CRDT has fresh item identities: serving it without persisting lets
// a returning client (IndexedDB cache of a previous rebuild) merge two
// independent rebuilds and duplicate the document. Exactly one rebuild may
// ever exist — the FOR UPDATE re-read makes concurrent replicas agree on it.
async function persistMigratedSnapshot(
  documentName: string,
  baseVersion: number,
  migrated: Buffer<ArrayBuffer>
): Promise<Uint8Array> {
  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ version: number; data: Buffer }[]>`
        SELECT version, data FROM "Documents"
        WHERE "documentId" = ${documentName}
        ORDER BY version DESC
        LIMIT 1
        FOR UPDATE
      `
      const head = rows[0] ?? null
      // Someone advanced the doc first (another replica's migration or a live
      // save): serve THEIR bytes and retry migration on a later load.
      if (head && head.version > baseVersion) return new Uint8Array(head.data)

      await tx.documents.create({
        data: {
          documentId: documentName,
          commitMessage: 'Schema migration',
          version: (head?.version ?? 0) + 1,
          data: migrated
        }
      })
      return migrated
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await prisma.documents.findFirst({
        where: { documentId: documentName },
        orderBy: { version: 'desc' },
        select: { data: true }
      })
      if (winner?.data) return new Uint8Array(winner.data)
    }
    throw err
  }
}

const configureExtensions = () => {
  const extensions: any[] = []

  if (config.hocuspocus.throttle.enabled) {
    extensions.push(
      new Throttle({
        throttle: config.hocuspocus.throttle.attempts,
        banTime: config.hocuspocus.throttle.banTime
      })
    )
  }

  if (config.hocuspocus.logger.enabled) {
    const log = config.hocuspocus.logger
    extensions.push(
      new Logger({
        onLoadDocument: log.onLoadDocument,
        onChange: log.onChange,
        onConnect: log.onConnect,
        onDisconnect: log.onDisconnect,
        onUpgrade: log.onUpgrade,
        onRequest: log.onRequest,
        onDestroy: log.onDestroy,
        onConfigure: log.onConfigure
      })
    )
  }

  if (config.app.env === 'production' && config.redis.enabled) {
    // Note: @hocuspocus/extension-redis creates its own Redis connection.
    // Mirror the centralized db/tls selection or the sync layer silently
    // connects to a different logical DB than the queues.
    const redisOptions: any = {
      host: config.redis.host || 'localhost',
      port: config.redis.port,
      options: {
        db: config.redis.db,
        tls: config.redis.tls ? {} : undefined,
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {})
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
            orderBy: { version: 'desc' },
            select: { data: true, version: true }
          })

          const rawState = doc?.data ?? generateDefaultState()

          // On-load migration: convert old nested schema to flat on first open.
          // Controlled by ENABLE_SCHEMA_MIGRATION env var — remove after all docs migrated.
          if (doc?.data && checkEnvBoolean(process.env.ENABLE_SCHEMA_MIGRATION)) {
            try {
              const ydoc = new Y.Doc()
              const buffer = rawState instanceof Buffer ? new Uint8Array(rawState) : rawState
              Y.applyUpdate(ydoc, buffer)
              const pmJson = TiptapTransformer.fromYdoc(ydoc, 'default') as Record<
                string,
                unknown
              > | null

              if (pmJson && (isOldSchema(pmJson as any) || hasLegacyMediaNodes(pmJson as any))) {
                dbLogger.info(
                  { documentName },
                  'On-load schema migration: nested→flat + media node rename'
                )
                const migrated = renameMediaNodes(transformNestedToFlat(pmJson as any) as any)
                const newYdoc = TiptapTransformer.toYdoc(
                  migrated as unknown as Record<string, unknown>,
                  'default',
                  migrationExtensions
                )
                const migratedState = Buffer.from(Y.encodeStateAsUpdate(newYdoc))
                return await persistMigratedSnapshot(documentName, doc.version, migratedState)
              }
            } catch (migrationErr) {
              dbLogger.warn(
                { err: migrationErr, documentName },
                'Schema migration failed, serving original'
              )
            }
          }

          return rawState
        } catch (err) {
          dbLogger.error({ err }, 'Error fetching document data')
          captureUnknown(err)
          // Never $disconnect() the shared pool here — one document's transient
          // fetch error would tear the pool out from under every concurrent
          // query. pg evicts broken clients per-connection on its own.
          throw err
        }
      },

      async store(data: any) {
        const { documentName, state, context, document } = data

        // Metadata rides the live doc — read it O(1). Decoding the snapshot
        // here (the old path) rebuilt the whole CRDT on the WS event loop and
        // stalled every connection on the instance; the worker strips the
        // metadata keys off the snapshot instead.
        const meta = document.getMap('metadata')

        // If the document is draft, don't store the data
        if (meta.get('isDraft')) return

        const commitMessageValue = meta.get('commitMessage')
        const commitMessage = typeof commitMessageValue === 'string' ? commitMessageValue : ''
        // Consume the one-shot restore label: left on the live doc it would
        // stamp every later autosave as a named checkpoint (exempt from
        // pruning) until page reload. Runs before enqueue so the queue-down
        // fallback consumes it too; server-origin deletes don't re-trigger saves.
        if (commitMessage) meta.delete('commitMessage')
        const stateBuffer: Buffer = state

        try {
          await enqueueStoreDocument({
            jobId: buildStoreJobId(documentName, stateBuffer),
            documentName,
            state: stateBuffer,
            context,
            commitMessage
          })
        } catch (err) {
          // Fallback: direct DB save when the enqueue fails while the redlock
          // was held (Redis OOM window, producer command timeout). A hard
          // Redis outage never reaches here — extension-redis aborts the
          // store chain first and persistence pauses until Redis returns.
          documentPersistFallbackTotal.inc()
          dbLogger.warn({ err, documentName }, 'Queue unavailable, falling back to direct save')
          captureDegraded('queue-fallback', err, { extra: { documentName } })

          try {
            const snapshot = stripSnapshotMetadata(stateBuffer)

            // Use transaction with FOR UPDATE lock to prevent race conditions.
            // Multiple Hocuspocus instances may hit this fallback simultaneously
            // (redlock can lapse mid-store), so merge with the locked head like
            // the worker does — a plain insert of divergent state would clobber.
            await prisma.$transaction(async (tx) => {
              const existingDocs = await tx.$queryRaw<{ version: number; data: Buffer }[]>`
                SELECT version, data FROM "Documents"
                WHERE "documentId" = ${documentName}
                ORDER BY version DESC
                LIMIT 1
                FOR UPDATE
              `
              const existingDoc = existingDocs[0] ?? null
              const versionData = existingDoc
                ? Buffer.from(
                    Y.mergeUpdates([new Uint8Array(existingDoc.data), new Uint8Array(snapshot)])
                  )
                : snapshot

              await tx.documents.create({
                data: {
                  documentId: documentName,
                  commitMessage: commitMessage || '',
                  version: existingDoc ? existingDoc.version + 1 : 1,
                  data: versionData
                }
              })
            })

            dbLogger.info({ documentName }, 'Document saved via fallback (direct DB)')
          } catch (dbErr) {
            dbLogger.error(
              { err: dbErr, documentName },
              'Fallback save failed - document may be lost'
            )
            captureUnknown(dbErr)
            throw dbErr
          }
        }
      }
    })
  )

  extensions.push(healthCheck)

  // Add Redis subscriber for save confirmations (requires Redis)
  if (config.redis.enabled) {
    extensions.push(new RedisSubscriberExtension())
  }

  // Add document view tracking (requires Supabase)
  if (config.supabase.url && config.supabase.serviceRoleKey) {
    extensions.push(new DocumentViewsExtension())
    dbLogger.info('Document view tracking enabled')
  }

  return extensions
}

export default () => {
  // Build extensions ONCE. Re-invoking configureExtensions() (the old onListen did)
  // opens a second set of Redis/DB connections that are never closed — a leak.
  const extensions = configureExtensions()
  return {
    name: getServerName(),
    port: config.hocuspocus.port,
    extensions,
    debounce: 10_000, // 10 seconds - wait for user to stop typing
    maxDebounce: 60_000, // 60 seconds - force save even if user keeps typing (prevents data loss)
    // The app's shutdown() owns SIGTERM ordering (destroy → closeQueues → …);
    // the library's own handler would process.exit(0) before that tail runs.
    stopOnSignals: false,

    async onListen(data: any) {
      healthCheck.onConfigure({ ...data, extensions })
    },

    onRequest(data: any) {
      return new Promise<void>((resolve, reject) => {
        const { request, response } = data

        const healthRoutes: Record<string, () => unknown> = {
          '/health': () => healthCheck.getHealth(),
          '/health/websocket': () => healthCheck.status.websocket,
          '/health/database': () => healthCheck.getDatabaseStatus(),
          '/health/redis': () => healthCheck.getRedisStatus()
        }

        const buildPayload = healthRoutes[request.url]
        if (buildPayload) {
          response.writeHead(200, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify(buildPayload()))
          // reject() short-circuits Hocuspocus's default request handling.
          return reject()
        }

        resolve()
      })
    }
  }
}
