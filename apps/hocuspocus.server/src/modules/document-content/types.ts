import type { Hocuspocus } from '@hocuspocus/server'
import type { DocumentMetadata, PrismaClient } from '@prisma/client'
import type { Logger } from 'pino'
import type * as Y from 'yjs'

/** Tiptap document JSON as it arrives on the wire. Real validation is the encode step. */
export interface TiptapDocJson {
  type: 'doc'
  content: Record<string, unknown>[]
}

export type ApplyMode = 'replace' | 'append'
export type ReadFormat = 'json' | 'text'

/** Narrows the untyped JSON this module walks; shared by the domain and hop layers. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Yjs transaction origin for API-applied content, so client plugins can tell it apart. */
export const CONTENT_APPLY_ORIGIN = 'document-content-api'

/** Byte cap on every content-bearing request body (PATCH and POST alike). */
export const MAX_CONTENT_BYTES = 5 * 1024 * 1024
// Bytes do not bound encode cost — node count does (250k empty nodes block the
// shared WS event loop ~232ms; 5 MiB of paragraph text costs ~20ms). Depth is
// capped separately so the pre-walk cannot be handed input it must recurse into.
export const MAX_CONTENT_NODES = 50_000
export const MAX_CONTENT_DEPTH = 100

/** REST→WS hop budget. `replace` is idempotent on retry; `append` is at-least-once. */
export const WS_APPLY_TIMEOUT_MS = 30_000

/** Fail-closed encode result. `invalid-content` is the single 422 discriminant. */
export type EncodeOutcome =
  { ok: true; scratch: Y.Doc } | { ok: false; reason: 'invalid-content'; detail: string }

export type ApplyOutcome =
  | { status: 'applied' }
  | { status: 'not-found' }
  | { status: 'invalid-content'; detail: string }
  /** The document could not be opened; nothing was applied or broadcast. */
  | { status: 'open-failed' }
  | { status: 'persist-failed' }

/**
 * Hop-only outcomes. `upstream-unauthorized` is separate from `unreachable`
 * because the likeliest cause is the two processes holding different
 * service-role keys, and a 503 would send operators after a dead network.
 */
export type WsApplyOutcome =
  ApplyOutcome | { status: 'unreachable' } | { status: 'upstream-unauthorized' }

/**
 * The hop re-serializes as `{mode, content}`, which is a few bytes longer than
 * the `{content}` REST already capped. The internal cap keeps that headroom so
 * a near-limit body fails as 413 at the edge instead of 503 from inside.
 */
export const INTERNAL_BODY_HEADROOM_BYTES = 1024

/** Snapshot decode result; corrupt bytes fail closed rather than throwing. */
export type ReadOutcome =
  { ok: true; content: TiptapDocJson | string } | { ok: false; error: unknown }

export type CreateOutcome =
  { status: 'created'; document: DocumentMetadata } | { status: 'invalid-content'; detail: string }

export interface ApplyRequest {
  documentId: string
  mode: ApplyMode
  content: TiptapDocJson
  /** Names the version row this apply mints; absent leaves the row unnamed. */
  commitMessage?: string
  requestId?: string
  payloadBytes?: number
}

/** Why a version row exists. Projected onto the row, never a read predicate. */
export type VersionTrigger = 'api' | 'checkpoint' | 'revert'

/**
 * Attribution for the version row an apply mints. `forceKey` only widens the
 * store job id, so a named row cannot dedupe onto an unnamed one for the same
 * bytes; it is not attribution and never reaches the row.
 */
export interface VersionStamp {
  name?: string
  trigger: VersionTrigger
  triggeredBy: string | null
  forceKey?: string
}

/** The applier's view: the wire name has already been resolved into a stamp. */
export interface ApplyContentRequest extends Omit<ApplyRequest, 'commitMessage'> {
  version?: VersionStamp
}

/**
 * The DirectConnection context, which the store hook reads to attribute the row
 * it mints. Presence is the contract: an explicit `versionTriggeredBy: null`
 * means nobody, while an absent key means "fall back to the connection user".
 */
export interface ApplyContext {
  user?: { sub: string; email?: string }
  slug: string
  documentId: string
  deviceType: 'service'
  versionName?: string
  versionTrigger?: VersionTrigger
  versionTriggeredBy?: string | null
  versionForceKey?: string
}

/** Wire shapes for the two public content routes. */
export interface ContentApplyResponseData {
  documentId: string
  mode: ApplyMode
}

export interface ContentReadResponseData {
  documentId: string
  version: number
  format: ReadFormat
  content: TiptapDocJson | string
}

export type VerifyServiceRole = (authHeader: string | undefined) => boolean

export interface InitDeps {
  prisma: PrismaClient
  logger: Logger
  verifyServiceRole: VerifyServiceRole
  /** Outbound bearer for the internal hop; the inbound check reads the key itself. */
  serviceRoleKey: string | null
  wsApplyBaseUrl: string
}

export interface InitWsApplyDeps {
  hocuspocus: Hocuspocus
  prisma: PrismaClient
  logger: Logger
  verifyServiceRole: VerifyServiceRole
}
