import type { PrismaClient } from '@prisma/client'
import type { Context, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Logger } from 'pino'

import { fail, ok } from '../../../http/envelope'
import { captureUnknown } from '../../../lib/instrument'
import { emptyContent, readContent } from '../domain/readContent'
import { findDocumentMeta, findHeadRow } from '../infra/contentStore'
import type { ApplyContent } from '../infra/hocuspocusApply'
import type { WsApplyClient } from '../infra/wsApplyClient'
import type {
  ApplyMode,
  ContentApplyResponseData,
  ContentReadResponseData,
  ReadFormat,
  TiptapDocJson,
  VersionStamp,
  WsApplyOutcome
} from '../types'
import { MAX_CONTENT_BYTES } from '../types'

// A repeat of this 500 for the same document means the per-doc debouncer is
// poisoned, and every later store rejects instantly. Retrying keeps mutating
// and broadcasting to live clients while never persisting.
const PERSIST_FAILED_MESSAGE =
  'The change may already be visible to live collaborators but was not persisted. Verify with GET before retrying; a repeat means server-side persistence is wedged.'

export const payloadTooLarge = (c: Context): Response =>
  fail(c, 413, 'PAYLOAD_TOO_LARGE', `Content exceeds the ${MAX_CONTENT_BYTES}-byte limit`)

export const contentBodyLimit = (maxSize: number = MAX_CONTENT_BYTES): MiddlewareHandler =>
  bodyLimit({ maxSize, onError: payloadTooLarge })

const applyOutcomeResponse = (
  c: Context,
  documentId: string,
  mode: ApplyMode,
  outcome: WsApplyOutcome
): Response => {
  switch (outcome.status) {
    case 'applied': {
      const body: ContentApplyResponseData = { documentId, mode }
      return ok(c, body)
    }
    case 'not-found':
      return fail(c, 404, 'NOT_FOUND', 'Document not found')
    case 'invalid-content':
      return fail(c, 422, 'UNPROCESSABLE_ENTITY', outcome.detail)
    case 'open-failed':
      return fail(
        c,
        500,
        'INTERNAL_SERVER_ERROR',
        'The document could not be opened. Nothing was applied or broadcast.'
      )
    case 'persist-failed':
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', PERSIST_FAILED_MESSAGE)
    case 'unreachable':
      return fail(c, 503, 'SERVICE_UNAVAILABLE', 'Content apply service is unavailable')
    case 'upstream-unauthorized':
      return fail(
        c,
        500,
        'INTERNAL_SERVER_ERROR',
        'The collaboration process rejected this service’s credentials. The two processes are configured with different service-role keys.'
      )
    default: {
      const exhaustive: never = outcome
      return exhaustive
    }
  }
}

export interface ReadControllerDeps {
  prisma: PrismaClient
  logger: Logger
}

export const createGetContentHandler =
  (deps: ReadControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string
    const { format } = c.req.valid('query' as never) as { format: ReadFormat }

    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return fail(c, 404, 'NOT_FOUND', 'Document not found')

    const head = await findHeadRow(deps.prisma, documentId)
    // Metadata without a snapshot row is a document nobody has persisted yet,
    // not an error — the caller gets an empty body at version 0.
    if (!head) {
      const empty: ContentReadResponseData = {
        documentId,
        version: 0,
        format,
        content: emptyContent(format)
      }
      return ok(c, empty)
    }

    const read = readContent(head.data, format)
    if (!read.ok) {
      deps.logger.error(
        { err: read.error, documentId, version: head.version },
        'Snapshot decode failed'
      )
      captureUnknown(read.error, { extra: { documentId, version: head.version } })
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Stored document content could not be decoded')
    }

    const body: ContentReadResponseData = {
      documentId,
      version: head.version,
      format,
      content: read.content
    }
    return ok(c, body)
  }

export interface ApplyControllerDeps {
  prisma: PrismaClient
  wsApply: WsApplyClient
}

export const createPatchContentHandler =
  (deps: ApplyControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string
    const { mode } = c.req.valid('query' as never) as { mode: ApplyMode }
    const { content, commitMessage } = c.req.valid('json' as never) as {
      content: TiptapDocJson
      commitMessage?: string
    }

    // Fast 404 without paying for the WS hop; the applier re-checks anyway.
    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return fail(c, 404, 'NOT_FOUND', 'Document not found')

    const outcome = await deps.wsApply({
      documentId,
      mode,
      content,
      commitMessage,
      requestId: c.get('requestId')
    })
    return applyOutcomeResponse(c, documentId, mode, outcome)
  }

export const createInternalApplyHandler =
  (applyContent: ApplyContent) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string
    const { mode, content, commitMessage } = c.req.valid('json' as never) as {
      mode: ApplyMode
      content: TiptapDocJson
      commitMessage?: string
    }
    const requestId = c.get('requestId') as string | undefined

    // Injected content is nobody's edit: the owner rides the context only so a
    // rowless first save mints correct metadata. The request id is hono-sanitized
    // to [\w\-=], so it is safe to widen a colon-separated store job id with.
    const version: VersionStamp = {
      ...(commitMessage ? { name: commitMessage, forceKey: requestId } : {}),
      trigger: 'api',
      triggeredBy: null
    }

    const outcome = await applyContent({
      documentId,
      mode,
      content,
      version,
      requestId,
      payloadBytes: Number(c.req.header('content-length') ?? 0) || undefined
    })
    return applyOutcomeResponse(c, documentId, mode, outcome)
  }
