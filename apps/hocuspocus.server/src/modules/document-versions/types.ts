import type { Hocuspocus } from '@hocuspocus/server'
import type { PrismaClient } from '@prisma/client'
import type { Logger } from 'pino'

import type { MachineVersionTrigger, StoreDocumentContext, VersionTrigger } from '../../types'
import type { ReadFormat, TiptapDocJson, VerifyServiceRole } from '../document-content/types'

// Re-exported so this stays the module's single type surface: the trigger
// vocabulary is shared with the store hook, the rest with the content module.
export type { MachineVersionTrigger, ReadFormat, TiptapDocJson, VerifyServiceRole, VersionTrigger }

/** Trimmed bound on a checkpoint name, matching the content API's row label. */
export const MAX_VERSION_NAME_CHARS = 200

/** Both write routes carry a name at most — content never rides this surface. */
export const VERSION_BODY_BYTES = 16 * 1024

export const DEFAULT_VERSION_PAGE_SIZE = 50
export const MAX_VERSION_PAGE_SIZE = 100

/** `Documents.version` is int4; anything past this is a 400, never a Prisma throw. */
export const MAX_VERSION_NUMBER = 2_147_483_647

/** REST→WS hop budget. A revert also writes a backup row inside this window. */
export const VERSION_OP_TIMEOUT_MS = 30_000

/** Separates a draft refusal from a content refusal inside the shared 422. */
export const DRAFT_DOCUMENT_CODE = 'DRAFT_DOCUMENT'

/** Separates "wrote nothing" from "may have written" inside the shared 500 —
 *  the hop otherwise reports an untouched document as possibly-live. */
export const BACKUP_FAILED_CODE = 'BACKUP_FAILED'

export const buildBackupName = (version: number): string => `Before restore of version ${version}`

export const buildRestoredName = (version: number): string => `Restored version ${version}`

/**
 * The `public.users` columns the history sidebar renders, snake_case preserved
 * to mirror the table. Supplied by the injected batch lookup, never selected here.
 */
export interface ProfileLite {
  id: string
  avatar_url: string | null
  avatar_updated_at: string | null
  full_name: string | null
  display_name: string | null
  status: string | null
}

/**
 * The DirectConnection context an op opens with. Extends the shape `store()`
 * actually reads, so the four `version*` field names cannot drift out of the
 * hook that resolves them. The two extra fields are what a WS connection carries.
 */
export interface VersionOpContext extends StoreDocumentContext {
  documentId: string
  deviceType: 'service'
}

/**
 * Attribution for the row an op mints. `forceKey` only widens the store job id
 * so a named save cannot dedupe onto a byte-identical autosave; it never
 * reaches the row.
 */
export interface VersionStamp {
  name: string
  trigger: Extract<VersionTrigger, 'checkpoint' | 'revert'>
  triggeredBy: string | null
  forceKey: string
}

export type CheckpointOutcome =
  | { status: 'checkpointed' }
  | { status: 'not-found' }
  | { status: 'draft-document' }
  | { status: 'open-failed' }
  | { status: 'persist-failed' }

export type RevertOutcome =
  | { status: 'reverted'; restoredFrom: number; backupVersion: number }
  | { status: 'not-found' }
  | { status: 'invalid-content'; detail: string }
  | { status: 'draft-document' }
  | { status: 'open-failed' }
  | { status: 'backup-failed' }
  | { status: 'persist-failed' }

/**
 * Hop-only outcomes. `upstream-unauthorized` is separate from `unreachable`
 * because the likeliest cause is the two processes holding different
 * service-role keys. A 503 would send operators after a dead network.
 */
type HopFailure = { status: 'unreachable' } | { status: 'upstream-unauthorized' }

export type WsCheckpointOutcome = CheckpointOutcome | HopFailure

export type WsRevertOutcome =
  | { status: 'reverted'; restoredFrom: number; backupVersion: number | null }
  | Exclude<RevertOutcome, { status: 'reverted' }>
  | HopFailure

export type VersionOpFailure = Exclude<
  CheckpointOutcome | RevertOutcome,
  { status: 'checkpointed' } | { status: 'reverted' }
>

export type VersionFailureReason =
  | 'unauthorized'
  | 'read-only'
  | 'not-found'
  | 'invalid-content'
  | 'persist-failed'
  | 'draft-document'
  /** Raised by the gate, not an op: the per-document revert cooldown. */
  | 'rate-limited'

export const versionFailureReason = (outcome: VersionOpFailure): VersionFailureReason => {
  switch (outcome.status) {
    case 'not-found':
      return 'not-found'
    case 'draft-document':
      return 'draft-document'
    case 'invalid-content':
      return 'invalid-content'
    default:
      return 'persist-failed'
  }
}

export interface VersionListItem {
  version: number
  name: string | null
  trigger: VersionTrigger | null
  triggeredBy: ProfileLite | null
  contributors: ProfileLite[]
  createdAt: Date
}

export interface VersionListResponseData {
  documentId: string
  versions: VersionListItem[]
  total: number
  limit: number
  offset: number
}

export interface VersionReadResponseData {
  documentId: string
  version: number
  format: ReadFormat
  content: TiptapDocJson | string
}

/** The ack means the save pipeline was triggered, not that a row exists yet. */
export interface CheckpointResponseData {
  documentId: string
  name: string
}

export interface RestoreResponseData {
  documentId: string
  restoredFrom: number
  /** Null only when the collaboration process's reply was unreadable; the row exists. */
  backupVersion: number | null
}

export interface VersionDeleteResponseData {
  documentId: string
  version: number
  deleted: true
}

export interface CheckpointParams {
  name: string
  actorId?: string | null
}

export interface RevertParams {
  actorId?: string | null
}

export interface VersionOps {
  checkpointOp: (documentId: string, params: CheckpointParams) => Promise<CheckpointOutcome>
  revertOp: (
    documentId: string,
    targetVersion: number,
    params: RevertParams
  ) => Promise<RevertOutcome>
}

/** Batch profile lookup. Contractually fail-soft: `[]` rather than a throw. */
export type GetOwnerProfiles = (userIds: string[]) => Promise<ProfileLite[]>

/**
 * Injected, never imported: a static `lib/queue` import boots two BullMQ queues
 * and a Redis socket at module scope. This module's index is loaded by REST.
 */
export type StripSnapshotMetadata = (state: Uint8Array) => Buffer<ArrayBuffer>

export interface InitDeps {
  prisma: PrismaClient
  logger: Logger
  verifyServiceRole: VerifyServiceRole
  /** Outbound bearer for the internal hop; the inbound check reads the key itself. */
  serviceRoleKey: string | null
  wsOpsBaseUrl: string
  getOwnerProfiles: GetOwnerProfiles
}

export interface InitWsOpsDeps {
  hocuspocus: Hocuspocus
  prisma: PrismaClient
  logger: Logger
  verifyServiceRole: VerifyServiceRole
  stripSnapshotMetadata: StripSnapshotMetadata
}

/** Editor-regenerated identity attrs. Whatever this strips, the author walk must
 *  also ignore, or a toc-id rewriter gets credited for an unchanged block. */
export const VOLATILE_BLOCK_ATTRS: ReadonlySet<string> = new Set(['toc-id'])

export const DIFF_PREVIEW_CHARS = 200
export const MAX_DIFF_CHANGES = 500
/** 1M cells is a 4 MB Int32Array per in-flight diff, and still matches a
 *  1000x1000 block pair exactly. 4M cells was 16 MB on an unthrottled route. */
export const MAX_DIFF_LCS_CELLS = 1_000_000

export type BlockChangeKind = 'added' | 'removed' | 'changed'

export interface BlockChange {
  kind: BlockChangeKind
  /** Top-level index in the newer document; on `removed`, in the older one. */
  index: number
  nodeType: string
  /** ProseMirror positions in the newer document. Absent on `removed`. */
  from?: number
  to?: number
  before?: string
  after?: string
  /** Yjs clientIDs holding live content in this block. Always empty on `removed`:
   *  gc:true erased the deleted items, so nothing can name who removed it. */
  clientIds: number[]
}

export interface BlockDiff {
  /** 0 when the newer version has no predecessor — the whole document reads added. */
  fromVersion: number
  toVersion: number
  blocksBefore: number
  blocksAfter: number
  changes: BlockChange[]
  /** True count. `changes.length < totalChanges` means the list was clipped. */
  totalChanges: number
  /** Matching exceeded MAX_DIFF_LCS_CELLS and degenerated to remove-all/add-all. */
  coarse: boolean
  /** Y root items did not align with PM top-level nodes; every clientIds is empty. */
  unattributed: boolean
}

export interface DiffAuthor {
  clientId: number
  /** Null when the binding row exists but no public.users row resolved. */
  user: ProfileLite | null
  anonymous: boolean
}

/** One entry per clientId that HAS a binding row. A clientId present in
 *  `changes[].clientIds` but absent here is unattributed. */
export interface VersionDiffResponseData extends BlockDiff {
  documentId: string
  authors: DiffAuthor[]
}

export interface VersionSnapshot {
  version: number
  data: Uint8Array
}
