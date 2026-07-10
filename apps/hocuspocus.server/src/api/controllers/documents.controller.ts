/**
 * Documents Controller
 *
 * Handles document CRUD operations.
 * Validation is done in the router via zValidator - controllers receive pre-validated data.
 */

import { AppError, getErrorResponse } from '../../lib/errors'
import { captureHttpError } from '../../lib/instrument'
import { documentsControllerLogger } from '../../lib/logger'
import { resolvePrivateAccess } from '../../lib/privateAccess'
import type {
  CreateDocumentInput,
  DocumentQueryInput,
  TrashPurgeInput,
  TrashRestoreInput,
  UpdateDocumentMetadataInput
} from '../../schemas/document.schema'
import type { AppContext } from '../../types/hono.types'
import * as documentsService from '../services/documents.service'
import * as mediaService from '../services/media.service'

// Helper to get validated data with proper typing
const getValidJson = <T>(c: AppContext): T => (c.req as any).valid('json') as T
const getValidQuery = <T>(c: AppContext): T => (c.req as any).valid('query') as T

// Standard error response handler
const handleError = (c: AppContext, error: unknown, context: Record<string, unknown> = {}) => {
  documentsControllerLogger.error({ err: error, ...context }, 'Document operation failed')
  const statusCode = (error instanceof AppError ? error.statusCode : 500) as 400 | 404 | 500
  captureHttpError(error, { extra: context })
  return c.json(
    getErrorResponse(error instanceof Error ? error : new Error(String(error))),
    statusCode
  )
}

// Private slug 403 with a top-level `access` hint the webapp gate reads to pick its CTA.
const privateGateResponse = (c: AppContext, access: 'sign-in-required' | 'denied') =>
  c.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'This document is private' }, access },
    403
  )

// Strict-owner 403 for lifecycle actions; returned directly (not thrown) so it
// stays out of the 5xx Sentry path, mirroring the private-gate/list-owner checks.
const forbiddenResponse = (c: AppContext) =>
  c.json(
    {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only the owner can modify this document' }
    },
    403
  )

export const getDocumentBySlug = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const docName = c.req.param('docName')
  if (docName === undefined) return c.json({ error: 'Missing document name' }, 400)

  const user = c.get('user')
  const requesterId = c.get('userId')

  try {
    const doc = await documentsService.getDocumentBySlug(prisma, docName)

    if (!doc) {
      return c.json({ success: true, data: documentsService.createDraftDocument(docName) })
    }

    // Soft-deleted → hard 404 (never the draft path): drafting mints a NEW documentId under
    // this still-@unique slug, escaping every doc-scoped seal and colliding on persist.
    if (doc.deletedAt) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
        404
      )
    }

    if (doc.isPrivate) {
      const access = resolvePrivateAccess({
        isPrivate: true,
        ownerId: doc.ownerId,
        userId: requesterId,
        isAnonymous: user?.is_anonymous
      })
      if (access !== 'allow') return privateGateResponse(c, access)
    }

    return c.json({ success: true, data: doc })
  } catch (error) {
    return handleError(c, error, { docName })
  }
}

export const listDocuments = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const query = getValidQuery<DocumentQueryInput>(c)
  const requesterId = c.get('userId') as string | undefined

  if (query.ownerId) {
    if (!requesterId) {
      return c.json(
        { success: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } },
        401
      )
    }
    if (query.ownerId !== requesterId) {
      return c.json({ success: false, error: { message: 'Forbidden', code: 'FORBIDDEN' } }, 403)
    }
  }

  // Trash is strictly the caller's own soft-deleted docs — auth-gate it and
  // owner-scope to the token subject (never a client-supplied ownerId).
  const wantsTrash = query.deleted === 'true'
  if (wantsTrash && !requesterId) {
    return c.json(
      { success: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } },
      401
    )
  }

  const limit = parseInt(query.limit || '10', 10)
  const offset = parseInt(query.offset || '0', 10)

  try {
    const result = await documentsService.searchDocuments(prisma, {
      title: query.title,
      keywords: query.keywords,
      description: query.description,
      ownerId: wantsTrash ? requesterId : query.ownerId,
      requesterId,
      deleted: wantsTrash,
      sort: query.sort,
      limit,
      offset
    })

    return c.json({ success: true, data: result })
  } catch (error) {
    return handleError(c, error)
  }
}

export const createDocument = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const body = getValidJson<CreateDocumentInput>(c)
  const user = c.get('user')

  try {
    const doc = await documentsService.createDocument(prisma, {
      slug: body.slug,
      title: body.title,
      description: body.description,
      keywords: body.keywords,
      userId: user?.sub,
      email: user?.email
    })

    return c.json({ success: true, data: doc })
  } catch (error) {
    return handleError(c, error, { slug: body.slug })
  }
}

export const updateDocument = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const docId = c.req.param('docId')
  if (docId === undefined) return c.json({ error: 'Missing document id' }, 400)
  const body = getValidJson<UpdateDocumentMetadataInput>(c)
  const requesterId = c.get('userId')

  try {
    const doc = await documentsService.updateDocument(prisma, docId, body, requesterId)
    return c.json({ success: true, data: doc })
  } catch (error) {
    return handleError(c, error, { docId })
  }
}

export const deleteDocument = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const documentId = c.req.param('documentId')
  if (documentId === undefined) return c.json({ error: 'Missing document id' }, 400)
  const requesterId = c.get('userId') as string | undefined

  try {
    const result = await documentsService.softDeleteDocument(prisma, documentId, requesterId)
    if (!result.authorized) return forbiddenResponse(c)
    return c.json({ success: true })
  } catch (error) {
    return handleError(c, error, { documentId })
  }
}

export const restoreDocument = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const documentId = c.req.param('documentId')
  if (documentId === undefined) return c.json({ error: 'Missing document id' }, 400)
  const requesterId = c.get('userId') as string | undefined

  try {
    const result = await documentsService.restoreDocument(prisma, documentId, requesterId)
    if (!result.authorized) return forbiddenResponse(c)
    return c.json({ success: true })
  } catch (error) {
    return handleError(c, error, { documentId })
  }
}

export const permanentDeleteDocument = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const documentId = c.req.param('documentId')
  if (documentId === undefined) return c.json({ error: 'Missing document id' }, 400)
  const requesterId = c.get('userId') as string | undefined

  try {
    const result = await documentsService.permanentlyDeleteDocument(prisma, documentId, requesterId)
    if (result.status === 'forbidden') return forbiddenResponse(c)
    if (result.status === 'not-deleted') {
      return c.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Document must be deleted before it can be permanently removed'
          }
        },
        400
      )
    }
    return c.json({ success: true })
  } catch (error) {
    return handleError(c, error, { documentId })
  }
}

// Bulk Trash purge — owner-scoped to the token subject (never a client id). Empty
// body empties the whole trash; { ids } purges that selection. Returns the count.
export const purgeTrash = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  // requireUser guarantees userId (401 upstream on a missing/invalid token) —
  // trust it like every sibling handler; the service also guards the empty-all
  // query so a missing owner can never widen the scope.
  const requesterId = c.get('userId') as string
  const { ids } = getValidJson<TrashPurgeInput>(c)

  try {
    const result = await documentsService.purgeTrash(prisma, requesterId, ids)
    return c.json({ success: true, data: result })
  } catch (error) {
    return handleError(c, error, { requesterId })
  }
}

// Bulk Trash restore — owner-scoped; { ids } required. Returns the count restored.
export const restoreTrash = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  // requireUser guarantees userId; each id is owner-gated in the service loop.
  const requesterId = c.get('userId') as string
  const { ids } = getValidJson<TrashRestoreInput>(c)

  try {
    const result = await documentsService.restoreTrash(prisma, requesterId, ids)
    return c.json({ success: true, data: result })
  } catch (error) {
    return handleError(c, error, { requesterId })
  }
}

export const duplicateDocument = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const documentId = c.req.param('documentId')
  if (documentId === undefined) return c.json({ error: 'Missing document id' }, 400)
  const user = c.get('user')
  const requesterId = c.get('userId') as string | undefined

  try {
    const result = await documentsService.duplicateDocument(
      prisma,
      documentId,
      requesterId,
      user?.email
    )
    if (result.status === 'forbidden') return forbiddenResponse(c)
    if (result.status === 'not-found') {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
        404
      )
    }
    return c.json({ success: true, data: result.document })
  } catch (error) {
    return handleError(c, error, { documentId })
  }
}

export const getMedia = async (c: AppContext): Promise<Response> => {
  const { documentId, mediaId } = c.req.param()
  if (documentId === undefined || mediaId === undefined) {
    return c.json({ error: 'Missing document or media id' }, 400)
  }

  try {
    return await mediaService.getMedia(documentId, mediaId, c)
  } catch (error) {
    return handleError(c, error, { documentId, mediaId })
  }
}

export const uploadMedia = async (c: AppContext): Promise<Response> => {
  const documentId = c.req.param('documentId')
  if (documentId === undefined) return c.json({ error: 'Missing document id' }, 400)
  const userId = c.get('userId')

  try {
    const formData = await c.req.formData()
    const mediaFile = formData.get('mediaFile')

    if (!mediaFile || typeof mediaFile === 'string') {
      return c.json({ error: 'No valid file was uploaded' }, 400)
    }

    const result = await mediaService.uploadMedia(documentId, mediaFile)
    return c.json(result, 201)
  } catch (error) {
    return handleError(c, error, { documentId, userId })
  }
}
