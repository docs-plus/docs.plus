import { captureUnknown } from '../../../lib/instrument'
import { documentContentApplyTotal } from '../../../lib/metrics'
import { applyContentToDoc } from '../domain/applyContentToDoc'
import {
  encodeContent,
  startsWithTitleHeading,
  TITLE_HEADING_DETAIL
} from '../domain/encodeContent'
import type {
  ApplyContentRequest,
  ApplyContext,
  ApplyOutcome,
  InitWsApplyDeps,
  VersionStamp
} from '../types'
import { findDocumentMeta } from './contentStore'

const METRIC_OUTCOME: Record<ApplyOutcome['status'], string> = {
  applied: 'applied',
  'not-found': 'not_found',
  'invalid-content': 'invalid_content',
  'open-failed': 'error',
  'persist-failed': 'error'
}

const stampVersion = (context: ApplyContext, version: VersionStamp): void => {
  if (version.name) context.versionName = version.name
  context.versionTrigger = version.trigger
  context.versionTriggeredBy = version.triggeredBy
  if (version.forceKey) context.versionForceKey = version.forceKey
}

/**
 * Deliberately asymmetric. A live edit landing between this flush and the
 * disconnect flush must mint an honest unnamed, unattributed row. The name goes
 * but an explicit null stays. Clearing the force key would re-derive the plain
 * job id on that flush and mint a duplicate row.
 */
const consumeVersionStamp = (context: ApplyContext): void => {
  delete context.versionName
  delete context.versionTrigger
  context.versionTriggeredBy = null
}

export type ApplyContent = (request: ApplyContentRequest) => Promise<ApplyOutcome>

/**
 * WS-process applier: the one path where injected content reaches a live Y.Doc.
 * `openDirectConnection` hardcodes an authenticated, writable connection and
 * never runs `onAuthenticate`. Metadata existence and the tombstone are
 * re-checked here, not inherited from the REST pre-check.
 */
export const createApplyContent = (
  deps: Omit<InitWsApplyDeps, 'verifyServiceRole'>
): ApplyContent => {
  const { hocuspocus, prisma, logger } = deps

  return async ({ documentId, mode, content, version, requestId, payloadBytes }) => {
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

    // A faithful WS-shaped context, not hygiene. A defensively-rowless first save
    // reads `context.slug` unguarded in the worker, and `{}` would stamp the
    // 19-char documentId into the ops email link.
    const context: ApplyContext = {
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
      captureUnknown(error, { extra: { documentId } })
      return finish({ status: 'open-failed' })
    }

    try {
      // Appending into an empty fragment IS the document's first node, so the
      // title-first contract applies there too.
      const fragmentEmpty = (connection.document?.getXmlFragment('default').length ?? 0) === 0
      if (mode === 'append' && fragmentEmpty && !startsWithTitleHeading(content.content)) {
        return finish({ status: 'invalid-content', detail: TITLE_HEADING_DETAIL })
      }

      // Stamped only once the apply is certain to run. `finally` disconnects on
      // every path. A rejected-content return would otherwise leave the name on
      // the context for that flush to mint a row from.
      if (version) stampVersion(context, version)

      try {
        await connection.transact((document) => applyContentToDoc(document, encoded.scratch, mode))
      } finally {
        // Consume on the rejection path too. The `finally` disconnect below
        // re-runs the store hooks against this same context object. A surviving
        // stamp mints a named row for an apply that 500'd.
        if (version) consumeVersionStamp(context)
      }
      return finish({ status: 'applied' })
    } catch (error) {
      logger.error({ err: error, documentId, mode }, 'Content apply transact rejected')
      captureUnknown(error, { extra: { documentId, mode } })
      return finish({ status: 'persist-failed' })
    } finally {
      // A rejected store leaves the debouncer's execution uncleared, so
      // disconnect() rejects too. A bare await would swap the crafted
      // persist-failed 500 for a generic onError 500 plus Sentry noise.
      await connection
        .disconnect()
        .catch((error) => logger.error({ err: error, documentId }, 'Disconnect after apply failed'))
    }
  }
}
