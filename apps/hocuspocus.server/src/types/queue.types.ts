// Rows the server mints for itself: the pre-restore safety copy and the
// one-time schema rebuild. They carry a name, so retention can only tell them
// from a checkpoint a person chose by reading this (see pruneAutosaveVersions).
export const MACHINE_VERSION_TRIGGERS = ['revert-backup', 'schema-migration'] as const
export type MachineVersionTrigger = (typeof MACHINE_VERSION_TRIGGERS)[number]

// Provenance stamped on a Documents row. Live collaborative saves are
// 'websocket'; the rest are one-shot operations that ride the connection
// context of the caller that opened the direct connection.
export type VersionTrigger = 'websocket' | 'api' | 'checkpoint' | 'revert' | MachineVersionTrigger

export interface StoreDocumentContext {
  slug?: string
  user?: {
    sub?: string
    email?: string
    is_anonymous?: boolean
    // Supabase user_metadata fields
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

// BullMQ document storage job data
export interface StoreDocumentData {
  documentName: string
  /** Redis claim-check key holding the raw Y.js state (preferred shape). */
  stateKey?: string
  /** Inline base64 Y.js state — legacy in-flight jobs and the DLQ payload embed. */
  state?: string
  context: StoreDocumentContext
  commitMessage?: string
  // Attribution resolved in the store hook, never re-derived from `context`:
  // the hook is the only place that can tell an explicit null from an absent key.
  trigger?: VersionTrigger
  triggeredBy?: string | null
  contributors?: string[]
}

/** Resolved store-hook payload passed to `enqueueStoreDocument`. */
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

// Dead letter queue data (for failed jobs)
export interface DeadLetterJobData extends StoreDocumentData {
  originalJobId?: string
  failureReason?: string
  failedAt?: string
}
