import type { Logger } from 'pino'

import { internalHop } from '../../../lib/internalHop'
import { isRecord } from '../../document-content/types'
import type { WsCheckpointOutcome, WsRevertOutcome } from '../types'
import { BACKUP_FAILED_CODE, DRAFT_DOCUMENT_CODE, VERSION_OP_TIMEOUT_MS } from '../types'

export interface WsVersionsClientDeps {
  baseUrl: string
  serviceRoleKey: string | null
  logger: Logger
}

export interface CheckpointHopRequest {
  documentId: string
  name: string
  requestId?: string
}

export interface RestoreHopRequest {
  documentId: string
  version: number
  requestId?: string
}

export interface WsVersionsClient {
  checkpoint: (request: CheckpointHopRequest) => Promise<WsCheckpointOutcome>
  restore: (request: RestoreHopRequest) => Promise<WsRevertOutcome>
}

const envelopeError = (body: unknown): { message?: string; code?: string } => {
  if (!isRecord(body) || !isRecord(body.error)) return {}
  const { message, code } = body.error
  return {
    message: typeof message === 'string' ? message : undefined,
    code: typeof code === 'string' ? code : undefined
  }
}

const envelopeNumber = (body: unknown, key: string): number | null => {
  if (!isRecord(body) || !isRecord(body.data)) return null
  const value = body.data[key]
  return typeof value === 'number' ? value : null
}

/** REST → WS hop for the two ops that need the live Y.Doc. Reads are Prisma-only. */
export const createWsVersionsClient = (deps: WsVersionsClientDeps): WsVersionsClient => {
  const checkpoint = async (request: CheckpointHopRequest): Promise<WsCheckpointOutcome> => {
    const hop = await internalHop({
      baseUrl: deps.baseUrl,
      path: ['internal', 'documents', request.documentId, 'versions'],
      body: { name: request.name },
      serviceRoleKey: deps.serviceRoleKey,
      requestId: request.requestId,
      timeoutMs: VERSION_OP_TIMEOUT_MS
    })

    if (!hop.ok) {
      deps.logger.error(
        { err: hop.error, documentId: request.documentId, url: hop.url },
        'Internal checkpoint unreachable'
      )
      return { status: 'unreachable' }
    }

    switch (hop.status) {
      case 200:
        return { status: 'checkpointed' }
      case 404:
        return { status: 'not-found' }
      // A checkpoint has no content to reject, so its only 422 is the draft guard.
      case 422:
        return { status: 'draft-document' }
      case 500:
        return { status: 'persist-failed' }
      case 401:
      case 403:
        deps.logger.error(
          { documentId: request.documentId, status: hop.status },
          'Internal checkpoint rejected our service-role bearer'
        )
        return { status: 'upstream-unauthorized' }
      default:
        deps.logger.error(
          {
            documentId: request.documentId,
            status: hop.status,
            message: envelopeError(hop.body).message
          },
          'Unexpected status from the internal checkpoint endpoint'
        )
        return { status: 'unreachable' }
    }
  }

  const restore = async (request: RestoreHopRequest): Promise<WsRevertOutcome> => {
    const hop = await internalHop({
      baseUrl: deps.baseUrl,
      path: [
        'internal',
        'documents',
        request.documentId,
        'versions',
        String(request.version),
        'restore'
      ],
      body: {},
      serviceRoleKey: deps.serviceRoleKey,
      requestId: request.requestId,
      timeoutMs: VERSION_OP_TIMEOUT_MS
    })

    if (!hop.ok) {
      deps.logger.error(
        { err: hop.error, documentId: request.documentId, url: hop.url },
        'Internal restore unreachable'
      )
      return { status: 'unreachable' }
    }

    const { message, code } = envelopeError(hop.body)

    switch (hop.status) {
      case 200:
        return {
          status: 'reverted',
          restoredFrom: envelopeNumber(hop.body, 'restoredFrom') ?? request.version,
          backupVersion: envelopeNumber(hop.body, 'backupVersion')
        }
      case 404:
        return { status: 'not-found' }
      case 422:
        return code === DRAFT_DOCUMENT_CODE
          ? { status: 'draft-document' }
          : { status: 'invalid-content', detail: message ?? 'invalid content' }
      // The document is untouched when the backup failed, so it must not inherit
      // persist-failed's "may already be visible to collaborators" wording.
      case 500:
        return code === BACKUP_FAILED_CODE
          ? { status: 'backup-failed' }
          : { status: 'persist-failed' }
      case 401:
      case 403:
        deps.logger.error(
          { documentId: request.documentId, status: hop.status },
          'Internal restore rejected our service-role bearer'
        )
        return { status: 'upstream-unauthorized' }
      default:
        deps.logger.error(
          { documentId: request.documentId, status: hop.status, message },
          'Unexpected status from the internal restore endpoint'
        )
        return { status: 'unreachable' }
    }
  }

  return { checkpoint, restore }
}
