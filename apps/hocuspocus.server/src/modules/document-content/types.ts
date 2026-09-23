import type { Hocuspocus } from '@hocuspocus/server'
import type { DocumentMetadata, PrismaClient } from '@prisma/client'
import type { JSONContent } from '@tiptap/core'
import type { Logger } from 'pino'
import type * as Y from 'yjs'

import type { VerifyServiceRole } from '../../http/serviceRole'

export type { VerifyServiceRole }

/** Real validation is the encode step. */
export interface TiptapDocJson {
  type: 'doc'
  content: Record<string, unknown>[]
}

export type ApplyMode = 'replace' | 'append' | 'section'
export type ReadFormat = 'json' | 'text'

/** The attr that keys a heading's section, chat room and digest links. */
export const TOC_ID_ATTR = 'toc-id'

/** Yjs transaction origin for API-applied content, so client plugins can tell it apart. */
export const CONTENT_APPLY_ORIGIN = 'document-content-api'

export const MAX_CONTENT_BYTES = 5 * 1024 * 1024
// Bytes do not bound encode cost — node count does (250k empty nodes block the
// shared WS event loop ~232ms; 5 MiB of paragraph text costs ~20ms). Depth is
// capped separately so the pre-walk cannot be handed input it must recurse into.
export const MAX_CONTENT_NODES = 50_000
export const MAX_CONTENT_DEPTH = 100

/** REST→WS hop budget. `replace` is idempotent on retry; `append` is at-least-once. */
export const WS_APPLY_TIMEOUT_MS = 30_000

/**
 * The WS applier's own budget, counted from arrival. It must stay below the hop
 * timeout, which stays below REST's 60 s idleTimeout. Otherwise REST reports a
 * failure over a write that then commits.
 */
export const WS_APPLY_DEADLINE_MS = 20_000
export const COMMIT_POLL_MS = 50

/** Fail-closed encode result. `invalid-content` is the single 422 discriminant. */
export type EncodeOutcome =
  { ok: true; scratch: Y.Doc } | { ok: false; reason: 'invalid-content'; detail: string }

/** The hop client maps 503s by these codes: `busy` and `not-confirmed` state different facts. */
export const DOCUMENT_BUSY_CODE = 'DOCUMENT_BUSY'
export const NOT_CONFIRMED_CODE = 'SAVE_NOT_CONFIRMED'

/**
 * `busy`: the per-document lock was still held at the deadline, so nothing was
 * applied. `not-confirmed`: applied, but the worker did not commit it in time.
 */
export type ApplyOutcome =
  | { status: 'applied'; version?: number }
  | { status: 'not-found' }
  | { status: 'invalid-content'; detail: string }
  | { status: 'conflict'; detail: string }
  | { status: 'open-failed' }
  | { status: 'persist-failed' }
  | { status: 'busy' }
  | { status: 'not-confirmed' }

/**
 * Hop-only outcomes. `upstream-unauthorized` is separate from `unreachable`
 * because the likeliest cause is the two processes holding different
 * service-role keys. A 503 would send operators after a dead network.
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

/** The newest content: the live room when one is loaded, else the persisted head. */
export type ContentReadOutcome =
  { status: 'ok'; content: JSONContent } | { status: 'not-found' } | { status: 'unavailable' }

/** The person an MCP write acts for. Absent on REST, which names nobody. */
export interface ApplyActor {
  sub: string
  email?: string
}

export interface ApplyRequest {
  documentId: string
  mode: ApplyMode
  content: TiptapDocJson
  /** `toc-id` of the target heading; required for `section`. */
  sectionId?: string
  /** The section `rev` the caller read; required for `section`. */
  rev?: string
  actor?: ApplyActor
  commitMessage?: string
  requestId?: string
  payloadBytes?: number
}

/** Why a version row exists. Projected onto the row, never a read predicate. */
export type VersionTrigger = 'api' | 'mcp' | 'checkpoint' | 'revert'

/**
 * Attribution for the version row an apply mints. `forceKey` only widens the
 * store job id, so a named row cannot dedupe onto an unnamed one for the same
 * bytes. It is not attribution and never reaches the row.
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
  user?: ApplyActor
  slug: string
  documentId: string
  deviceType: 'service'
  versionName?: string
  versionTrigger?: VersionTrigger
  versionTriggeredBy?: string | null
  versionForceKey?: string
}

export interface ContentApplyResponseData {
  documentId: string
  mode: ApplyMode
  /** The committed version row that holds this write, when the applier waited for one. */
  version?: number
}

export interface ContentReadResponseData {
  documentId: string
  version: number
  format: ReadFormat
  content: TiptapDocJson | string
}

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
