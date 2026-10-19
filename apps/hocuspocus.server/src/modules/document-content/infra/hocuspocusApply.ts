import * as Y from 'yjs'

import { documentContentApplyTotal } from '../../../lib/metrics'
import { applyContentToDoc } from '../domain/applyContentToDoc'
import {
  encodeContent,
  startsWithTitleHeading,
  TITLE_HEADING_DETAIL
} from '../domain/encodeContent'
import type { ApplyContentRequest, ApplyOutcome, InitWsApplyDeps } from '../types'
import { createLiveWrite } from './liveWrite'

const METRIC_OUTCOME: Record<ApplyOutcome['status'], string> = {
  applied: 'applied',
  'not-found': 'not_found',
  'invalid-content': 'invalid_content',
  conflict: 'conflict',
  'open-failed': 'error',
  'persist-failed': 'error',
  busy: 'busy',
  'not-confirmed': 'not_confirmed'
}

type InvalidContent = Extract<ApplyOutcome, { status: 'invalid-content' }>

export type ApplyContent = (request: ApplyContentRequest) => Promise<ApplyOutcome>

/** WS-process applier: the one path where injected content reaches a live Y.Doc. */
export const createApplyContent = (
  deps: Omit<InitWsApplyDeps, 'verifyServiceRole'>
): ApplyContent => {
  const { logger } = deps
  const liveWrite = createLiveWrite(deps)

  const apply = async (request: ApplyContentRequest): Promise<ApplyOutcome> => {
    const { documentId, mode, content, sectionId, rev, from, to, oldText, newText } = request
    let scratch!: Y.Doc

    const written = await liveWrite.write(documentId, {
      stamp: request.version,
      actor: request.actor,
      prepare: (): InvalidContent | undefined => {
        // A text edit and a block delete bring no nodes, so there is nothing to encode.
        if (content.content.length === 0) {
          scratch = new Y.Doc()
          return undefined
        }
        const encoded = encodeContent(content, { requireTitleHeading: mode === 'replace' })
        if (!encoded.ok) return { status: 'invalid-content', detail: encoded.detail }
        scratch = encoded.scratch
        return undefined
      },
      // Appending into an empty fragment IS the document's first node, so the
      // title-first contract applies there too.
      check: (room): InvalidContent | undefined =>
        mode === 'append' &&
        room.getXmlFragment('default').length === 0 &&
        !startsWithTitleHeading(content.content)
          ? { status: 'invalid-content', detail: TITLE_HEADING_DETAIL }
          : undefined,
      mutate: (doc) =>
        applyContentToDoc(
          doc,
          scratch,
          mode,
          sectionId && rev ? { sectionId, rev, from, to, oldText, newText } : undefined
        )
    })

    if (written.status !== 'done') return written
    const { result } = written
    if (!result.ok) return { status: result.status, detail: result.detail }
    if (written.unconfirmed) return { status: 'not-confirmed' }
    return {
      status: 'applied',
      ...(result.rev ? { rev: result.rev } : {}),
      ...(written.version !== undefined ? { version: written.version } : {})
    }
  }

  return async (request) => {
    const startedAt = Date.now()
    const { documentId, mode, requestId, payloadBytes } = request

    const outcome = await apply(request)

    documentContentApplyTotal.inc({ mode, outcome: METRIC_OUTCOME[outcome.status] })
    const line = {
      documentId,
      mode,
      outcome: outcome.status,
      durationMs: Date.now() - startedAt,
      payloadBytes,
      requestId
    }
    if (
      outcome.status === 'persist-failed' ||
      outcome.status === 'open-failed' ||
      outcome.status === 'not-confirmed'
    )
      logger.error(line, 'Content apply failed')
    else logger.info(line, 'Content apply')
    return outcome
  }
}
