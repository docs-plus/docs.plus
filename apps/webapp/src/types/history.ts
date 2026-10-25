// One source: the backend union. Type-only, so no backend code reaches the bundle.
import type { VersionTrigger } from '../../../hocuspocus.server/src/types/versionTrigger'

export type { VersionTrigger }

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
}

/** Uid -> profile. Authors repeat across a page, so it ships once per response. */
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
  /** Base64 Yjs update from `history.watch`. */
  data?: string
  trigger?: VersionTrigger | null
  /** Uid credited with the save; resolve through the response's profile map. */
  triggeredBy?: string | null
  contributors?: string[]
}

export type HistoryAnchor = { since: string; item: HistoryItem }
