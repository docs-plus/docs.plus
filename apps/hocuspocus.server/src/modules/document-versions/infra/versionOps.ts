import type { Hocuspocus } from '@hocuspocus/server'
import * as Y from 'yjs'

import { drainContributors } from '../../../lib/contributors'
import { ydocToPmJson } from '../../../lib/nested-flat-migration'
import { applyContentToDoc } from '../../document-content/domain/applyContentToDoc'
import { encodeContent } from '../../document-content/domain/encodeContent'
import type { DocumentContentMeta } from '../../document-content/infra/contentStore'
import { findDocumentMeta } from '../../document-content/infra/contentStore'
import type { TiptapDocJson } from '../../document-content/types'
import type {
  CheckpointOutcome,
  CheckpointParams,
  InitWsOpsDeps,
  RevertOutcome,
  RevertParams,
  VersionOpContext,
  VersionOps,
  VersionStamp
} from '../types'
import { buildBackupName, buildRestoredName } from '../types'
import { appendBackupRow, findVersionRow } from './versionsStore'

type DirectConnection = Awaited<ReturnType<Hocuspocus['openDirectConnection']>>

type Commit = (mutate: (document: Y.Doc) => void) => Promise<void>

/** Base-36 and colon-free: BullMQ's `validateOptions` throws on ':' in a job id. */
const forceKey = (): string => Math.random().toString(36).slice(2, 12)

const stampVersion = (context: VersionOpContext, stamp: VersionStamp): void => {
  if (stamp.name) context.versionName = stamp.name
  context.versionTrigger = stamp.trigger
  context.versionTriggeredBy = stamp.triggeredBy
  context.versionForceKey = stamp.forceKey
}

/**
 * Deliberately asymmetric. A live edit landing between this flush and the
 * disconnect flush must mint an honest unnamed, unattributed row, so the name
 * goes but an explicit null stays. Clearing the force key would re-derive the
 * plain job id on that flush and mint a duplicate row.
 */
const consumeVersionStamp = (context: VersionOpContext): void => {
  delete context.versionName
  delete context.versionTrigger
  context.versionTriggeredBy = null
}

export const createVersionOps = (deps: Omit<InitWsOpsDeps, 'verifyServiceRole'>): VersionOps => {
  const { hocuspocus, prisma, logger, stripSnapshotMetadata } = deps

  // A faithful WS-shaped context, not hygiene: a defensively-rowless first save
  // reads `context.slug` unguarded in the worker, and `{}` would stamp the
  // 19-char documentId into the ops email link.
  const buildContext = (meta: DocumentContentMeta, documentId: string): VersionOpContext => ({
    user: meta.ownerId ? { sub: meta.ownerId, email: meta.email ?? undefined } : undefined,
    slug: meta.slug,
    documentId,
    deviceType: 'service'
  })

  const isDraft = (connection: DirectConnection): boolean =>
    Boolean(connection.document?.getMap('metadata').get('isDraft'))

  const runWithDirectConnection = async <T>(
    documentId: string,
    context: VersionOpContext,
    stamp: VersionStamp,
    run: (connection: DirectConnection, commit: Commit) => Promise<T>
  ): Promise<T | { status: 'open-failed' } | { status: 'persist-failed' }> => {
    let connection: DirectConnection
    try {
      connection = await hocuspocus.openDirectConnection(documentId, context)
    } catch (error) {
      logger.error({ err: error, documentId }, 'Failed to open a direct connection')
      return { status: 'open-failed' }
    }

    // The stamp lands only once the write is certain: `finally` flushes on every
    // path, so a name set at open time would mint a named row for an op that
    // bailed — and retention never prunes a named row.
    const commit: Commit = async (mutate) => {
      stampVersion(context, stamp)
      try {
        await connection.transact(mutate)
      } finally {
        // Consume on the rejection path too: the `finally` disconnect below
        // re-runs the store hooks against this same context object, and a
        // surviving stamp mints a named, attributed row for an op that 500'd.
        consumeVersionStamp(context)
      }
    }

    try {
      return await run(connection, commit)
    } catch (error) {
      logger.error({ err: error, documentId }, 'Version op rejected')
      return { status: 'persist-failed' }
    } finally {
      // A rejected store leaves the debouncer's execution uncleared, so
      // disconnect() rejects too — a bare await would swap the crafted 500 for
      // a generic one plus Sentry noise.
      await connection
        .disconnect()
        .catch((error) =>
          logger.error({ err: error, documentId }, 'Disconnect after a version op failed')
        )
    }
  }

  const checkpointOp = async (
    documentId: string,
    params: CheckpointParams
  ): Promise<CheckpointOutcome> => {
    const meta = await findDocumentMeta(prisma, documentId)
    if (!meta || meta.deletedAt) return { status: 'not-found' }

    const stamp: VersionStamp = {
      name: params.name,
      trigger: 'checkpoint',
      triggeredBy: params.actorId ?? null,
      forceKey: forceKey()
    }

    return runWithDirectConnection<CheckpointOutcome>(
      documentId,
      buildContext(meta, documentId),
      stamp,
      async (connection, commit) => {
        if (isDraft(connection)) return { status: 'draft-document' }

        // Nothing to mutate: the empty transact exists to fire one immediate
        // store carrying the name. The force key is what keeps that store off
        // the byte dedupe of an autosave less than ten seconds old.
        await commit(() => {})
        return { status: 'checkpointed' }
      }
    )
  }

  const revertOp = async (
    documentId: string,
    targetVersion: number,
    params: RevertParams
  ): Promise<RevertOutcome> => {
    const meta = await findDocumentMeta(prisma, documentId)
    if (!meta || meta.deletedAt) return { status: 'not-found' }

    const row = await findVersionRow(prisma, documentId, targetVersion)
    if (!row) return { status: 'not-found' }

    // Validate before anything opens or writes: a row the current schema cannot
    // express must fail with the document and its history untouched.
    const decoded = ydocToPmJson(row.data)
    if (!decoded.ok) {
      logger.error(
        { err: decoded.error, documentId, version: targetVersion },
        'Version snapshot decode failed'
      )
      return { status: 'invalid-content', detail: 'stored version could not be decoded' }
    }

    // Caps off: these bytes are our own stored snapshot, and WS editing never
    // enforced them, so a document that outgrew the API limit would otherwise
    // have every one of its versions permanently unrestorable.
    const encoded = encodeContent(decoded.json as unknown as TiptapDocJson, {
      requireTitleHeading: true,
      enforceSizeCaps: false
    })
    if (!encoded.ok) return { status: 'invalid-content', detail: encoded.detail }

    const stamp: VersionStamp = {
      name: buildRestoredName(targetVersion),
      trigger: 'revert',
      triggeredBy: params.actorId ?? null,
      forceKey: forceKey()
    }

    return runWithDirectConnection<RevertOutcome>(
      documentId,
      buildContext(meta, documentId),
      stamp,
      async (connection, commit) => {
        if (isDraft(connection)) return { status: 'draft-document' }

        const live = connection.document
        if (!live) return { status: 'persist-failed' }

        // Capture the live doc — unsaved debounce-window work included — and
        // commit the backup before the restore exists, so a dead worker still
        // leaves the pre-restore state recoverable. Those unsaved edits belong
        // to the backup row, so drain the contributors onto it.
        const snapshot = stripSnapshotMetadata(Y.encodeStateAsUpdate(live))
        const backup = await appendBackupRow(prisma, {
          documentId,
          snapshot,
          name: buildBackupName(targetVersion),
          triggeredBy: params.actorId ?? null,
          contributors: drainContributors(live)
        })
        if (!backup.ok) {
          logger.error(
            { err: backup.error, documentId, version: targetVersion },
            'Restore backup append failed'
          )
          return { status: 'backup-failed' }
        }

        await commit((document) => applyContentToDoc(document, encoded.scratch, 'replace'))
        return { status: 'reverted', restoredFrom: targetVersion, backupVersion: backup.version }
      }
    )
  }

  return { checkpointOp, revertOp }
}
