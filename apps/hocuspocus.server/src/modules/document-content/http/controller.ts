import type { Hocuspocus } from '@hocuspocus/server'
import type { PrismaClient } from '@prisma/client'
import type { Context, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Logger } from 'pino'

import { fail, ok } from '../../../http/envelope'
import { captureUnknown } from '../../../lib/instrument'
import { emptyContent, liveDocJson, readContent } from '../domain/readContent'
import type { ContentClient } from '../infra/contentClient'
import { findDocumentMeta, findHeadRow } from '../infra/contentStore'
import type { ApplyContent } from '../infra/hocuspocusApply'
import type {
  ApplyActor,
  ApplyMode,
  ContentApplyResponseData,
  ContentReadResponseData,
  ReadFormat,
  TiptapDocJson,
  VersionStamp,
  WsApplyOutcome
} from '../types'
import { DOCUMENT_BUSY_CODE, MAX_CONTENT_BYTES, NOT_CONFIRMED_CODE } from '../types'

// A repeat of this 500 for the same document means the per-doc debouncer is
// poisoned, and every later store rejects instantly. Retrying keeps mutating
// and broadcasting to live clients while never persisting.
const PERSIST_FAILED_MESSAGE =
  'The change may already be visible to live collaborators but was not persisted. Verify with GET before retrying; a repeat means server-side persistence is wedged.'

// A GET cannot see a write the worker has not saved yet. Reading at once and
// retrying would apply the change twice.
const NOT_CONFIRMED_MESSAGE =
  'The change was applied but not confirmed as saved in time. It may still be saved. Wait about a minute, then verify with GET before retrying.'

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
      const body: ContentApplyResponseData = {
        documentId,
        mode,
        ...(outcome.version === undefined ? {} : { version: outcome.version })
      }
      return ok(c, body)
    }
    case 'not-found':
      return fail(c, 404, 'NOT_FOUND', 'Document not found')
    case 'invalid-content':
      return fail(c, 422, 'UNPROCESSABLE_ENTITY', outcome.detail)
    case 'conflict':
      return fail(c, 409, 'CONFLICT', outcome.detail)
    case 'busy':
      return fail(
        c,
        503,
        DOCUMENT_BUSY_CODE,
        'Another write to this document is still being saved. Nothing was applied. Retry later.'
      )
    case 'not-confirmed':
      return fail(c, 503, NOT_CONFIRMED_CODE, NOT_CONFIRMED_MESSAGE)
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
  content: ContentClient
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

    const outcome = await deps.content.apply({
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
    const { mode, content, commitMessage, sectionId, rev, actor } = c.req.valid(
      'json' as never
    ) as {
      mode: ApplyMode
      content: TiptapDocJson
      commitMessage?: string
      sectionId?: string
      rev?: string
      actor?: ApplyActor
    }
    const requestId = c.get('requestId') as string | undefined

    // A REST write is nobody's edit, so its row names no one. An MCP write
    // really acted for a signed-in person, so its row names that person. The
    // request id is hono-sanitized to [\w\-=], safe to widen a store job id with.
    const version: VersionStamp = {
      ...(commitMessage ? { name: commitMessage, forceKey: requestId } : {}),
      trigger: actor ? 'mcp' : 'api',
      triggeredBy: actor ? actor.sub : null
    }

    const outcome = await applyContent({
      documentId,
      mode,
      content,
      sectionId,
      rev,
      actor,
      version,
      requestId,
      payloadBytes: Number(c.req.header('content-length') ?? 0) || undefined
    })
    return applyOutcomeResponse(c, documentId, mode, outcome)
  }

export interface InternalReadDeps {
  hocuspocus: Hocuspocus
  prisma: PrismaClient
}

/**
 * Reads the room this process holds without opening a connection, so a read
 * never loads or pins a room. `content: null` means no room here: the caller
 * decodes the persisted head, which keeps that decode off the collab event loop.
 */
export const createInternalReadHandler =
  (deps: InternalReadDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string

    // Before the room: a soft-deleted document can still be loaded.
    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return fail(c, 404, 'NOT_FOUND', 'Document not found')

    const room = deps.hocuspocus.documents.get(documentId)
    return ok(c, { content: room ? liveDocJson(room) : null })
  }
