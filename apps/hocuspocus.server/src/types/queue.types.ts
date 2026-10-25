import type { StoreDlqDisposition } from '../lib/storeDlqDisposition'
import type { MachineVersionTrigger, VersionTrigger } from './versionTrigger'

export { MACHINE_VERSION_TRIGGERS } from './versionTrigger'
export type { MachineVersionTrigger, VersionTrigger }

export interface StoreDocumentContext {
  slug?: string
  user?: {
    sub?: string
    email?: string
    is_anonymous?: boolean
    user_metadata?: {
      full_name?: string
      name?: string
      avatar_url?: string
    }
  }
  /** Names the next stored version without touching the live doc's bytes. */
  versionName?: string
  versionTrigger?: Exclude<VersionTrigger, 'websocket' | MachineVersionTrigger>
  /** Present-but-null attributes the version to nobody; absent falls back to `user.sub`. */
  versionTriggeredBy?: string | null
  /** Colon-free (`[0-9a-z]+`) job-id suffix that keeps a forced save off the byte dedupe. */
  versionForceKey?: string
}

export interface StoreDocumentData {
  documentName: string
  /** Redis claim-check key holding the raw Y.js state (preferred shape). */
  stateKey?: string
  /** Inline base64 Y.js state — legacy in-flight jobs and the DLQ payload embed. */
  state?: string
  context: StoreDocumentContext
  commitMessage?: string
  // Attribution resolved in the store hook, never re-derived from `context`.
  // The hook is the only place that can tell an explicit null from an absent key.
  trigger?: VersionTrigger
  triggeredBy?: string | null
  contributors?: string[]
}

export interface EnqueueStoreDocumentParams {
  jobId: string
  documentName: string
  state: Buffer
  context: StoreDocumentContext
  commitMessage: string
  trigger?: VersionTrigger
  triggeredBy?: string | null
  contributors?: string[]
}

export interface DeadLetterJobData extends StoreDocumentData {
  originalJobId?: string
  failureReason?: string
  failedAt?: string
}

/** One parked dead-letter entry as the drain reports it to the operator. */
export interface StoreDlqEntry {
  jobId: string
  documentName: string
  stateBytes: number
  /** Newest stored version, or null when no row exists — a replay would email. */
  headVersion: number | null
  /** A row landed after this entry failed, so the replay likely duplicates it. */
  headSupersedes: boolean
  failureReason?: string
  failedAt?: string
  disposition: StoreDlqDisposition
}

export interface StoreDlqDrainResult {
  entries: StoreDlqEntry[]
  replayed: number
  discarded: number
  /** Trashed entries — removed on apply, not parked: the live path refused those saves. */
  skipped: number
  /** Left in the queue for an operator: no metadata row and no purge tombstone. */
  unresolved: number
  /** The whole parked queue, never the `documentId`-filtered slice. */
  depth: number
}
