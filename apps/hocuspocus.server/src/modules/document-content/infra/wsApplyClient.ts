import type { JSONContent } from '@tiptap/core'
import type { Logger } from 'pino'

import { internalHop } from '../../../lib/internalHop'
import { isRecord } from '../../../lib/isRecord'
import type { ApplyRequest, LiveReadOutcome, WsApplyOutcome } from '../types'
import { DOCUMENT_BUSY_CODE, NOT_CONFIRMED_CODE, WS_APPLY_TIMEOUT_MS } from '../types'

export interface WsApplyClient {
  apply: (request: ApplyRequest) => Promise<WsApplyOutcome>
  readLive: (documentId: string) => Promise<LiveReadOutcome>
}

export interface WsApplyClientDeps {
  baseUrl: string
  serviceRoleKey: string | null
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
export const createWsApplyClient = (deps: WsApplyClientDeps): WsApplyClient => {
  const apply: WsApplyClient['apply'] = async ({
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

  const readLive: WsApplyClient['readLive'] = async (documentId) => {
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
    return { status: 'unreachable' }
  }

  return { apply, readLive }
}
