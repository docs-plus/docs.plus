import type { Logger } from 'pino'

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
  const base = deps.baseUrl.replace(/\/+$/, '')

  return async ({ documentId, mode, content, requestId }) => {
    const url = `${base}/internal/documents/${encodeURIComponent(documentId)}/content`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deps.serviceRoleKey ?? ''}`,
          ...(requestId ? { 'x-request-id': requestId } : {})
        },
        body: JSON.stringify({ mode, content }),
        signal: AbortSignal.timeout(WS_APPLY_TIMEOUT_MS)
      })
    } catch (error) {
      deps.logger.error({ err: error, documentId, url }, 'Internal content apply unreachable')
      return { status: 'unreachable' }
    }

    // Drain before branching, always: a bodyLimit 413 is not JSON, and an
    // unconsumed body holds the keep-alive socket out of the pool under a storm.
    const raw = await response.text().catch(() => '')
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      body = undefined
    }

    switch (response.status) {
      case 200:
        return { status: 'applied' }
      case 404:
        return { status: 'not-found' }
      case 422:
        return { status: 'invalid-content', detail: errorMessage(body) ?? 'invalid content' }
      case 500:
        return { status: 'persist-failed' }
      case 401:
      case 403:
        deps.logger.error(
          { documentId, status: response.status },
          'Internal content apply rejected our service-role bearer'
        )
        return { status: 'upstream-unauthorized' }
      default:
        deps.logger.error(
          { documentId, status: response.status, message: errorMessage(body) },
          'Unexpected status from the internal content apply endpoint'
        )
        return { status: 'unreachable' }
    }
  }
}
