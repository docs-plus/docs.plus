/** Provenance the server stamps on a version row. `websocket` is a live collaborative save. */
export type VersionTrigger =
  'websocket' | 'api' | 'checkpoint' | 'revert' | 'revert-backup' | 'schema-migration'

/** Why the server refused a version op. Drives the toast copy. */
export type VersionFailureReason =
  | 'unauthorized'
  | 'read-only'
  | 'not-found'
  | 'invalid-content'
  | 'persist-failed'
  | 'draft-document'
  | 'rate-limited'

/**
 * Author row from the server's `profiles` side table. snake_case mirrors
 * `public.users`, which is what makes it a `FaceSource` with no adapter.
 */
export interface HistoryProfile {
  id: string
  avatar_url: string | null
  avatar_updated_at: string | null
  full_name: string | null
  display_name: string | null
  status: string | null
}

/** Uid -> profile. The list is unpaginated and authors repeat, so it ships once per response. */
export type HistoryProfileMap = Record<string, HistoryProfile>

/**
 * Yjs clientID -> the person who first claimed it on a live socket. Provenance,
 * not an audit trail: the server records the first claimant and never overwrites.
 */
export interface ClientAuthorBinding {
  clientId: number
  userId: string
  isAnonymous: boolean
}

export interface HistoryItem {
  version: number
  createdAt: string
  commitMessage?: string
  /** Base64 Yjs update from `history.watch` / `latestSnapshot`. */
  data?: string
  trigger?: VersionTrigger | null
  /** Uid credited with the save; resolve through the response's profile map. */
  triggeredBy?: string | null
  contributors?: string[]
}
