import type { PrismaClient } from '@prisma/client'
import type { JSONContent } from '@tiptap/core'
import type { Logger } from 'pino'

import { internalHop } from '../../../lib/internalHop'
import { isRecord } from '../../../lib/isRecord'
import { emptyContent, readContent } from '../domain/readContent'
import type { ApplyRequest, ContentReadOutcome, WsApplyOutcome } from '../types'
import { DOCUMENT_BUSY_CODE, NOT_CONFIRMED_CODE, WS_APPLY_TIMEOUT_MS } from '../types'
import { findHeadRow } from './contentStore'

export interface ContentClient {
  apply: (request: ApplyRequest) => Promise<WsApplyOutcome>
  read: (documentId: string) => Promise<ContentReadOutcome>
}

export interface ContentClientDeps {
  baseUrl: string
  serviceRoleKey: string | null
  prisma: PrismaClient
  logger: Logger
}

const errorField = (body: unknown, field: 'message' | 'code'): string | undefined => {
  if (!isRecord(body) || !isRecord(body.error)) return undefined
  const value = body.error[field]
  return typeof value === 'string' ? value : undefined
}

const dataField = (body: unknown): Record<string, unknown> | undefined =>
  isRecord(body) && isRecord(body.data) ? body.data : undefined

/** REST → WS hop. Transport and envelope failures both collapse to `unreachable` (503). */
export const createContentClient = (deps: ContentClientDeps): ContentClient => {
  const apply: ContentClient['apply'] = async ({
    documentId,
    mode,
    content,
    commitMessage,
    sectionId,
    rev,
    actor,
    requestId
  }) => {
    const hop = await internalHop({
      baseUrl: deps.baseUrl,
      path: ['internal', 'documents', documentId, 'content'],
      body: {
        mode,
        content,
        ...(commitMessage ? { commitMessage } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(rev ? { rev } : {}),
        ...(actor ? { actor } : {})
      },
      serviceRoleKey: deps.serviceRoleKey,
      requestId,
      timeoutMs: WS_APPLY_TIMEOUT_MS
    })

    if (!hop.ok) {
      deps.logger.error(
        { err: hop.error, documentId, url: hop.url },
        'Internal content apply unreachable'
      )
      return { status: 'unreachable' }
    }

    switch (hop.status) {
      case 200: {
        const version = dataField(hop.body)?.version
        return typeof version === 'number' ? { status: 'applied', version } : { status: 'applied' }
      }
      case 404:
        return { status: 'not-found' }
      case 409:
        return { status: 'conflict', detail: errorField(hop.body, 'message') ?? 'conflict' }
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

  // The read shares the apply's hop budget. No read has been timed, so it has no number of its own.
  const readLive = async (
    documentId: string
  ): Promise<ContentReadOutcome | { status: 'not-loaded' }> => {
    const hop = await internalHop({
      baseUrl: deps.baseUrl,
      path: ['internal', 'documents', documentId, 'content', 'live'],
      body: {},
      serviceRoleKey: deps.serviceRoleKey,
      timeoutMs: WS_APPLY_TIMEOUT_MS
    })

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
