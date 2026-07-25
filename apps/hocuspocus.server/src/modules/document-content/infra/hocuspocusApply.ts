import { documentContentApplyTotal } from '../../../lib/metrics'
import { applyContentToDoc } from '../domain/applyContentToDoc'
import {
  encodeContent,
  startsWithTitleHeading,
  TITLE_HEADING_DETAIL
} from '../domain/encodeContent'
import type { ApplyOutcome, ApplyRequest, InitWsApplyDeps } from '../types'
import { findDocumentMeta } from './contentStore'

const METRIC_OUTCOME: Record<ApplyOutcome['status'], string> = {
  applied: 'applied',
  'not-found': 'not_found',
  'invalid-content': 'invalid_content',
  'open-failed': 'error',
  'persist-failed': 'error'
}

export type ApplyContent = (request: ApplyRequest) => Promise<ApplyOutcome>

/**
 * WS-process applier: the one path where injected content reaches a live Y.Doc.
 * `openDirectConnection` hardcodes an authenticated, writable connection and
 * never runs `onAuthenticate`, so metadata existence and the tombstone are
 * re-checked here rather than inherited from the REST pre-check.
 */
export const createApplyContent = (
  deps: Omit<InitWsApplyDeps, 'verifyServiceRole'>
): ApplyContent => {
  const { hocuspocus, prisma, logger } = deps

  return async ({ documentId, mode, content, requestId, payloadBytes }) => {
    const startedAt = Date.now()

    const finish = (outcome: ApplyOutcome): ApplyOutcome => {
      documentContentApplyTotal.inc({ mode, outcome: METRIC_OUTCOME[outcome.status] })
      const line = {
        documentId,
        mode,
        outcome: outcome.status,
        durationMs: Date.now() - startedAt,
        payloadBytes,
        requestId
      }
      if (outcome.status === 'persist-failed' || outcome.status === 'open-failed')
        logger.error(line, 'Content apply failed')
      else logger.info(line, 'Content apply')
      return outcome
    }

    const meta = await findDocumentMeta(prisma, documentId)
    if (!meta || meta.deletedAt) return finish({ status: 'not-found' })

    const encoded = encodeContent(content, { requireTitleHeading: mode === 'replace' })
    if (!encoded.ok) return finish({ status: 'invalid-content', detail: encoded.detail })

    // A faithful WS-shaped context, not hygiene: a defensively-rowless first save
    // reads `context.slug` unguarded in the worker, and `{}` would stamp the
    // 19-char documentId into the ops email link.
    const context = {
      user: meta.ownerId ? { sub: meta.ownerId, email: meta.email ?? undefined } : undefined,
      slug: meta.slug,
      documentId,
      deviceType: 'service'
    }

    let connection: Awaited<ReturnType<typeof hocuspocus.openDirectConnection>>
    try {
      connection = await hocuspocus.openDirectConnection(documentId, context)
    } catch (error) {
      logger.error({ err: error, documentId }, 'Failed to open a direct connection')
      return finish({ status: 'open-failed' })
    }

    try {
      // Appending into an empty fragment IS the document's first node, so the
      // title-first contract applies there too.
      const fragmentEmpty = (connection.document?.getXmlFragment('default').length ?? 0) === 0
      if (mode === 'append' && fragmentEmpty && !startsWithTitleHeading(content.content)) {
        return finish({ status: 'invalid-content', detail: TITLE_HEADING_DETAIL })
      }

      await connection.transact((document) => applyContentToDoc(document, encoded.scratch, mode))
      return finish({ status: 'applied' })
    } catch (error) {
      logger.error({ err: error, documentId, mode }, 'Content apply transact rejected')
      return finish({ status: 'persist-failed' })
    } finally {
      // A rejected store leaves the debouncer's execution uncleared, so
      // disconnect() rejects too — a bare await would swap the crafted
      // persist-failed 500 for a generic onError 500 plus Sentry noise.
      await connection
        .disconnect()
        .catch((error) => logger.error({ err: error, documentId }, 'Disconnect after apply failed'))
    }
  }
}
