import type { Logger } from 'pino'

import { internalHop } from '../../../lib/internalHop'
import type { ApplyRequest, WsApplyOutcome } from '../types'
import { isRecord } from '../types'
import { WS_APPLY_TIMEOUT_MS } from '../types'

export type WsApplyClient = (request: ApplyRequest) => Promise<WsApplyOutcome>

export interface WsApplyClientDeps {
  baseUrl: string
  serviceRoleKey: string | null
  logger: Logger
}

const errorMessage = (body: unknown): string | undefined => {
  if (!isRecord(body) || !isRecord(body.error)) return undefined
  return typeof body.error.message === 'string' ? body.error.message : undefined
}

/** REST → WS hop. Transport and envelope failures both collapse to `unreachable` (503). */
export const createWsApplyClient = (deps: WsApplyClientDeps): WsApplyClient => {
  return async ({ documentId, mode, content, commitMessage, requestId }) => {
    const hop = await internalHop({
      baseUrl: deps.baseUrl,
      path: ['internal', 'documents', documentId, 'content'],
      body: { mode, content, ...(commitMessage ? { commitMessage } : {}) },
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
      case 200:
        return { status: 'applied' }
      case 404:
        return { status: 'not-found' }
      case 422:
        return { status: 'invalid-content', detail: errorMessage(hop.body) ?? 'invalid content' }
      case 500:
        return { status: 'persist-failed' }
      case 401:
      case 403:
        deps.logger.error(
          { documentId, status: hop.status },
          'Internal content apply rejected our service-role bearer'
        )
        return { status: 'upstream-unauthorized' }
      default:
        deps.logger.error(
          { documentId, status: hop.status, message: errorMessage(hop.body) },
          'Unexpected status from the internal content apply endpoint'
        )
        return { status: 'unreachable' }
    }
  }
}
