import type { JSONContent } from '@tiptap/core'
import type { Logger } from 'pino'

import type { PrismaClient } from '../../../generated/prisma/client'
import { parseBareHttpOrigin } from '../../../lib/httpOrigin'
import { internalHop } from '../../../lib/internalHop'
import { isRecord } from '../../../lib/isRecord'
import type { RedisClient } from '../../../types'
import { emptyContent, readContent } from '../domain/readContent'
import type { ApplyRequest, ContentReadOutcome, RoomRegistryReader, WsApplyOutcome } from '../types'
import {
  DOCUMENT_BUSY_CODE,
  NOT_CONFIRMED_CODE,
  REQUIRE_LOADED_HEADER,
  ROOM_NOT_LOADED_CODE,
  WS_APPLY_TIMEOUT_MS
} from '../types'
import { findHeadRow } from './contentStore'
import { createRoomRegistryReader } from './roomRegistry'

export interface ContentClient {
  apply: (request: ApplyRequest) => Promise<WsApplyOutcome>
  read: (documentId: string) => Promise<ContentReadOutcome>
}

export interface ContentClientDeps {
  baseUrl: string
  serviceRoleKey: string | null
  prisma: PrismaClient
  logger: Logger
  /** Shared Redis client for multi-replica room-owner routing (#816). */
  redis?: RedisClient | null
  /** Explicit peer origin allowlist for non-DNS multi-replica topologies. */
  allowedPeerUrls?: readonly string[]
  /** Injectable room-owner reader (defaults to Redis-backed reader when `redis` is passed). */
  roomRegistry?: RoomRegistryReader
}

const errorField = (body: unknown, field: 'message' | 'code'): string | undefined => {
  if (!isRecord(body) || !isRecord(body.error)) return undefined
  const value = body.error[field]
  return typeof value === 'string' ? value : undefined
}

const dataField = (body: unknown): Record<string, unknown> | undefined =>
  isRecord(body) && isRecord(body.data) ? body.data : undefined

// Only unambiguous pre-connect failures are safe to fail over on a non-idempotent apply.
// Timeouts, aborts, and mid-response socket resets may have already mutated the doc.
const PRE_CONNECT_ERROR_CODES = new Set([
  'ConnectionRefused',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'FailedToOpenSocket'
])

/** True only when `fetch()` failed before establishing a TCP connection to the peer. */
export const isPreConnectError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; cause?: unknown }
  if (typeof record.code === 'string' && PRE_CONNECT_ERROR_CODES.has(record.code)) return true
  if (record.cause && record.cause !== error) return isPreConnectError(record.cause)
  return false
}

const originKey = (url: string): string => {
  const parsed = parseBareHttpOrigin(url)
  return parsed ? `${parsed.protocol}//${parsed.host}:${parsed.port}` : url.replace(/\/+$/, '')
}

type PeerStep<T> =
  | { kind: 'done'; outcome: T }
  | { kind: 'evict'; outcome: T; dead: boolean }
  | { kind: 'preserve'; outcome: T }

/** REST → WS hop. Transport and envelope failures both collapse to `unreachable` (503). */
export const createContentClient = (deps: ContentClientDeps): ContentClient => {
  const baseKey = originKey(deps.baseUrl)
  const roomRegistry: RoomRegistryReader | null =
    deps.roomRegistry ??
    (deps.redis
      ? createRoomRegistryReader({
          redis: deps.redis,
          baseUrl: deps.baseUrl,
          allowedPeerUrls: deps.allowedPeerUrls,
          logger: deps.logger
        })
      : null)

  const forgetStaleOwner = (documentId: string, peerUrl: string): void => {
    if (!roomRegistry) return
    void roomRegistry.removeOwner(documentId, peerUrl).catch(() => {})
  }

  const routeToOwner = async <T>(
    documentId: string,
    tryTarget: (targetUrl: string, isRegisteredPeer: boolean) => Promise<PeerStep<T>>,
    options: {
      skipFallbackIf: (state: { deadOrigins: Set<string>; triedOrigins: Set<string> }) => boolean
      finalize: (fallback: T | null, preserved: T | null, last: T | null) => T
    }
  ): Promise<T> => {
    const owners = roomRegistry ? await roomRegistry.lookupOwners(documentId) : []
    const deadOrigins = new Set<string>()
    const triedOrigins = new Set<string>()
    let preserved: T | null = null
    let lastOutcome: T | null = null

    for (const peerUrl of owners) {
      const key = originKey(peerUrl)
      triedOrigins.add(key)
      const step = await tryTarget(peerUrl, true)
      if (step.kind === 'done') return step.outcome
      if (step.kind === 'evict') {
        forgetStaleOwner(documentId, peerUrl)
        if (step.dead) deadOrigins.add(key)
      } else {
        preserved ??= step.outcome
      }
      lastOutcome = step.outcome
    }

    if (options.skipFallbackIf({ deadOrigins, triedOrigins })) {
      return options.finalize(null, preserved, lastOutcome)
    }
    const fallback = await tryTarget(deps.baseUrl, false)
    return options.finalize(fallback.outcome, preserved, lastOutcome)
  }

  const applyToTarget = async (
    targetUrl: string,
    documentId: string,
    body: Record<string, unknown>,
    requestId: string | undefined,
    requireLoaded: boolean
  ): Promise<
    WsApplyOutcome | { status: 'peer-not-loaded' } | { status: 'peer-pre-connect-failed' }
  > => {
    const hop = await internalHop({
      baseUrl: targetUrl,
      path: ['internal', 'documents', documentId, 'content'],
      body,
      serviceRoleKey: deps.serviceRoleKey,
      requestId,
      headers: requireLoaded ? { [REQUIRE_LOADED_HEADER]: '1' } : undefined,
      timeoutMs: WS_APPLY_TIMEOUT_MS
    })

    if (!hop.ok) {
      if (requireLoaded && isPreConnectError(hop.error)) {
        deps.logger.warn(
          { err: hop.error, documentId, url: hop.url },
          'Registered room owner unreachable before connect; cleaning stale entry'
        )
        return { status: 'peer-pre-connect-failed' }
      }
      deps.logger.error(
        { err: hop.error, documentId, url: hop.url },
        'Internal content apply unreachable'
      )
      return { status: 'unreachable' }
    }

    if (
      requireLoaded &&
      hop.status === 412 &&
      errorField(hop.body, 'code') === ROOM_NOT_LOADED_CODE
    ) {
      return { status: 'peer-not-loaded' }
    }

    switch (hop.status) {
      case 200: {
        const data = dataField(hop.body)
        return {
          status: 'applied',
          ...(typeof data?.version === 'number' ? { version: data.version } : {}),
          ...(typeof data?.rev === 'string' ? { rev: data.rev } : {})
        }
      }
      case 404:
        return { status: 'not-found' }
      case 409:
        return { status: 'conflict', detail: errorField(hop.body, 'message') ?? 'conflict' }
      case 413:
        return {
          status: 'invalid-content',
          detail: errorField(hop.body, 'message') ?? 'content exceeds the size limit'
        }
      case 422:
        return {
          status: 'invalid-content',
          detail: errorField(hop.body, 'message') ?? 'invalid content'
        }
      case 500:
        return { status: 'persist-failed' }
      case 503: {
        const code = errorField(hop.body, 'code')
        if (code === DOCUMENT_BUSY_CODE) return { status: 'busy' }
        if (code === NOT_CONFIRMED_CODE) return { status: 'not-confirmed' }
        return { status: 'unreachable' }
      }
      case 400:
        deps.logger.warn(
          { documentId, message: errorField(hop.body, 'message') },
          'Internal content apply refused the request shape'
        )
        return { status: 'rejected' }
      case 401:
      case 403:
        deps.logger.error(
          { documentId, status: hop.status },
          'Internal content apply rejected our service-role bearer'
        )
        return { status: 'upstream-unauthorized' }
      default:
        deps.logger.error(
          { documentId, status: hop.status, message: errorField(hop.body, 'message') },
          'Unexpected status from the internal content apply endpoint'
        )
        return { status: 'unreachable' }
    }
  }

  // JSON drops the undefined fields, so the body carries only what the mode set.
  const apply: ContentClient['apply'] = ({ documentId, requestId, ...body }) =>
    routeToOwner<WsApplyOutcome>(
      documentId,
      async (targetUrl, isPeer) => {
        const result = await applyToTarget(targetUrl, documentId, body, requestId, isPeer)
        if (result.status === 'peer-not-loaded') {
          return { kind: 'evict', outcome: { status: 'unreachable' }, dead: false }
        }
        if (result.status === 'peer-pre-connect-failed') {
          return { kind: 'evict', outcome: { status: 'unreachable' }, dead: true }
        }
        return { kind: 'done', outcome: result }
      },
      {
        skipFallbackIf: ({ deadOrigins }) => deadOrigins.has(baseKey),
        finalize: (fallback) => fallback ?? { status: 'unreachable' }
      }
    )

  // The read shares the apply's hop budget. No read has been timed, so it has no number of its own.
  const readLiveFrom = async (
    targetUrl: string,
    documentId: string,
    isRegisteredPeer: boolean
  ): Promise<
    ContentReadOutcome | { status: 'not-loaded' } | { status: 'peer-pre-connect-failed' }
  > => {
    const hop = await internalHop({
      baseUrl: targetUrl,
      path: ['internal', 'documents', documentId, 'content', 'live'],
      body: {},
      serviceRoleKey: deps.serviceRoleKey,
      timeoutMs: WS_APPLY_TIMEOUT_MS
    })

    if (!hop.ok && isRegisteredPeer && isPreConnectError(hop.error)) {
      deps.logger.warn(
        { err: hop.error, documentId, url: hop.url },
        'Registered room owner unreachable before connect; cleaning stale entry'
      )
      return { status: 'peer-pre-connect-failed' }
    }

    if (hop.ok && hop.status === 404) return { status: 'not-found' }
    const data = hop.ok && hop.status === 200 ? dataField(hop.body) : undefined
    if (data && isRecord(data.content))
      return { status: 'ok', content: data.content as JSONContent }
    if (data && data.content === null) return { status: 'not-loaded' }

    deps.logger.error(
      hop.ok
        ? { documentId, status: hop.status, message: errorField(hop.body, 'message') }
        : { err: hop.error, documentId, url: hop.url },
      'Internal live read failed'
    )
    return { status: 'unavailable' }
  }

  const readLive = (documentId: string): Promise<ContentReadOutcome | { status: 'not-loaded' }> =>
    routeToOwner<ContentReadOutcome | { status: 'not-loaded' }>(
      documentId,
      async (targetUrl, isPeer) => {
        const outcome = await readLiveFrom(targetUrl, documentId, isPeer)
        if (outcome.status === 'ok' || outcome.status === 'not-found') {
          return { kind: 'done', outcome }
        }
        if (outcome.status === 'not-loaded') {
          return { kind: 'evict', outcome, dead: false }
        }
        if (outcome.status === 'peer-pre-connect-failed') {
          return { kind: 'evict', outcome: { status: 'unavailable' }, dead: true }
        }
        return { kind: 'preserve', outcome }
      },
      {
        skipFallbackIf: ({ triedOrigins }) => triedOrigins.has(baseKey),
        finalize: (fallback, preserved, last) => {
          if (fallback) {
            if (fallback.status === 'ok' || fallback.status === 'not-found') return fallback
            return preserved ?? fallback
          }
          return preserved ?? last ?? { status: 'unavailable' }
        }
      }
    )

  // A loaded room answers from the collab process. A cold one is decoded here,
  // so a read never blocks the collab event loop.
  const read: ContentClient['read'] = async (documentId) => {
    const live = await readLive(documentId)
    if (live.status !== 'not-loaded') return live
    const head = await findHeadRow(deps.prisma, documentId)
    if (!head) return { status: 'ok', content: emptyContent('json') as JSONContent }
    const decoded = readContent(head.data, 'json')
    if (decoded.ok) return { status: 'ok', content: decoded.content as JSONContent }
    deps.logger.error(
      { err: decoded.error, documentId, version: head.version },
      'Snapshot decode failed'
    )
    return { status: 'unavailable' }
  }

  return { apply, read }
}
