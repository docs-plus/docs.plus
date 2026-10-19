import * as Y from 'yjs'

import { drainContributors } from '../../../lib/contributors'
import { captureUnknown } from '../../../lib/instrument'
import { ydocToPmJson } from '../../../lib/nested-flat-migration'
import { stripSnapshotMetadata } from '../../../lib/snapshotMetadata'
import { applyContentToDoc } from '../../document-content/domain/applyContentToDoc'
import { encodeContent } from '../../document-content/domain/encodeContent'
import { createLiveWrite } from '../../document-content/infra/liveWrite'
import type { NamedVersionStamp, TiptapDocJson } from '../../document-content/types'
import type {
  CheckpointOutcome,
  CheckpointParams,
  InitWsOpsDeps,
  RevertOutcome,
  RevertParams,
  VersionOps
} from '../types'
import { buildBackupName, buildRestoredName } from '../types'
import { appendBackupRow, findVersionRow } from './versionsStore'

/** Base-36 and colon-free: BullMQ's `validateOptions` throws on ':' in a job id. */
const forceKey = (): string => Math.random().toString(36).slice(2, 12)

const isDraft = (room: Y.Doc): boolean => Boolean(room.getMap('metadata').get('isDraft'))

type RevertRefusal = Exclude<RevertOutcome, { status: 'reverted' }>

export const createVersionOps = (deps: Omit<InitWsOpsDeps, 'verifyServiceRole'>): VersionOps => {
  const { prisma, logger } = deps
  const liveWrite = createLiveWrite(deps)

  const checkpointOp = async (
    documentId: string,
    params: CheckpointParams
  ): Promise<CheckpointOutcome> => {
    // Nothing to mutate: the flush exists to fire one immediate store carrying
    // the name. The force key keeps that store off the byte dedupe of an
    // autosave less than ten seconds old.
    const flushed = await liveWrite.flush(documentId, {
      stamp: {
        name: params.name,
        trigger: 'checkpoint',
        triggeredBy: params.actorId ?? null,
        forceKey: forceKey()
      },
      check: (room): CheckpointOutcome | undefined =>
        isDraft(room) ? { status: 'draft-document' } : undefined
    })
    return flushed.status === 'done' ? { status: 'checkpointed' } : flushed
  }

  const revertOp = async (
    documentId: string,
    targetVersion: number,
    params: RevertParams
  ): Promise<RevertOutcome> => {
    let scratch!: Y.Doc
    let backupVersion!: number

    const written = await liveWrite.write(documentId, {
      stamp: {
        name: buildRestoredName(targetVersion),
        trigger: 'revert',
        triggeredBy: params.actorId ?? null,
        forceKey: forceKey()
      } satisfies NamedVersionStamp,
      // Runs after the metadata check, so a tombstone 404s before the row read.
      // Validate before anything opens or writes: a row the current schema cannot
      // express must fail with the document and its history untouched.
      prepare: async (): Promise<RevertRefusal | undefined> => {
        const row = await findVersionRow(prisma, documentId, targetVersion)
        if (!row) return { status: 'not-found' }

        const decoded = ydocToPmJson(row.data)
        if (!decoded.ok) {
          logger.error(
            { err: decoded.error, documentId, version: targetVersion },
            'Version snapshot decode failed'
          )
          // Filed even though the caller gets a 422. The status is about the request,
          // but the cause is a corrupt stored row that is now permanently unrestorable.
          captureUnknown(decoded.error, { extra: { documentId, version: targetVersion } })
          return { status: 'invalid-content', detail: 'stored version could not be decoded' }
        }

        // Caps off: these bytes are our own stored snapshot, and WS editing never
        // enforced them. A document that outgrew the API limit would otherwise have
        // every one of its versions permanently unrestorable.
        const encoded = encodeContent(decoded.json as unknown as TiptapDocJson, {
          requireTitleHeading: true,
          enforceSizeCaps: false
        })
        if (!encoded.ok) return { status: 'invalid-content', detail: encoded.detail }
        scratch = encoded.scratch
        return undefined
      },
      check: async (room): Promise<RevertRefusal | undefined> => {
        if (isDraft(room)) return { status: 'draft-document' }

        // Capture the live doc, unsaved debounce-window work included. Commit the
        // backup before the restore exists, so a dead worker still leaves the
        // pre-restore state recoverable. Those unsaved edits belong to the backup
        // row, so drain the contributors onto it.
        const backup = await appendBackupRow(prisma, {
          documentId,
          snapshot: stripSnapshotMetadata(Y.encodeStateAsUpdate(room)),
          name: buildBackupName(targetVersion),
          triggeredBy: params.actorId ?? null,
          contributors: drainContributors(room)
        })
        if (!backup.ok) {
          logger.error(
            { err: backup.error, documentId, version: targetVersion },
            'Restore backup append failed'
          )
          captureUnknown(backup.error, { extra: { documentId, version: targetVersion } })
          return { status: 'backup-failed' }
        }
        backupVersion = backup.version
        return undefined
      },
      mutate: (doc) => applyContentToDoc(doc, scratch, 'replace')
    })

    if (written.status !== 'done') return written
    // An unconfirmed commit still answers reverted: the restore and its backup
    // exist, and the pending record makes the next cold write wait for it.
    return { status: 'reverted', restoredFrom: targetVersion, backupVersion }
  }

  return { checkpointOp, revertOp }
}
