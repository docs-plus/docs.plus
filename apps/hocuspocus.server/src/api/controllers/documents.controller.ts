import { fail, ok } from '../../http/envelope'
import { sendNewDocumentNotification } from '../../lib/email/document-notification'
import { AppError, getErrorResponse } from '../../lib/errors'
import { captureHttpError } from '../../lib/instrument'
import { documentsControllerLogger } from '../../lib/logger'
import { resolvePrivateAccess } from '../../lib/privateAccess'
import { getOwnerProfile } from '../../lib/profiles'
import { createDocumentWithContent } from '../../modules/document-content'
import type {
  CreateDocumentInput,
  DocumentQueryInput,
  SetDocumentFavoriteInput,
  TrashPurgeInput,
  TrashRestoreInput,
  UpdateDocumentMetadataInput
} from '../../schemas/document.schema'
import type { AppContext } from '../../types/hono.types'
import { authUnavailableResponse } from '../middleware/auth'
import * as documentsService from '../services/documents.service'
import * as mediaService from '../services/media.service'

const getValidJson = <T>(c: AppContext): T => (c.req as any).valid('json') as T
const getValidQuery = <T>(c: AppContext): T => (c.req as any).valid('query') as T

const handleError = (c: AppContext, error: unknown, context: Record<string, unknown> = {}) => {
  documentsControllerLogger.error({ err: error, ...context }, 'Document operation failed')
  const statusCode = (error instanceof AppError ? error.statusCode : 500) as 400 | 404 | 500
  captureHttpError(error, { extra: context })
  return c.json(
    getErrorResponse(error instanceof Error ? error : new Error(String(error))),
    statusCode
  )
}

// The one response the house envelope cannot build: a top-level `access` hint the
// webapp gate reads to pick its CTA. Widening `fail` for one caller is the wrong trade.
const privateGateResponse = (c: AppContext, access: 'sign-in-required' | 'denied') =>
  c.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'This document is private' }, access },
    403
  )

// Strict-owner 403 for lifecycle actions; returned directly (not thrown) so it
// stays out of the 5xx Sentry path, mirroring the private-gate/list-owner checks.
const forbiddenResponse = (c: AppContext) =>
  fail(c, 403, 'FORBIDDEN', 'Only the owner can modify this document')

export const getDocumentBySlug = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const docName = c.req.param('docName')
  if (docName === undefined) return c.json({ error: 'Missing document name' }, 400)

  const user = c.get('user')
  const requesterId = c.get('userId')

  try {
    const doc = await documentsService.getDocumentBySlug(prisma, docName)

    if (!doc) {
      return ok(c, await documentsService.createDraftDocument(prisma, docName))
    }

    // Soft-deleted → hard 404 (never the draft path): drafting mints a NEW documentId under
    // this still-@unique slug, escaping every doc-scoped seal and colliding on persist.
    if (doc.deletedAt) {
      return fail(c, 404, 'NOT_FOUND', 'Document not found')
    }

    if (doc.isPrivate) {
      if (c.get('authUnavailable')) return authUnavailableResponse(c)
      const access = resolvePrivateAccess({
        isPrivate: true,
        ownerId: doc.ownerId,
        userId: requesterId,
        isAnonymous: user?.is_anonymous
      })
      if (access !== 'allow') return privateGateResponse(c, access)
    }

    return ok(c, doc)
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
      return fail(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }
    if (query.ownerId !== requesterId) {
      return fail(c, 403, 'FORBIDDEN', 'Forbidden')
    }
  }

  // Trash is strictly the caller's own soft-deleted docs — auth-gate it and
  // owner-scope to the token subject (never a client-supplied ownerId).
  const wantsTrash = query.deleted === 'true'
  if (wantsTrash && !requesterId) {
    return fail(c, 401, 'UNAUTHORIZED', 'Authentication required')
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

    return ok(c, result)
  } catch (error) {
    return handleError(c, error)
  }
}

export const createDocument = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const body = getValidJson<CreateDocumentInput>(c)
  const user = c.get('user')
  const serviceRole = c.get('serviceRole') === true

  if ((body.content || body.ownerId) && !serviceRole) {
    return fail(c, 403, 'FORBIDDEN', 'content and ownerId require service-role authorization')
  }

  try {
    if (serviceRole && body.content) {
      const outcome = await createDocumentWithContent(prisma, {
        slug: body.slug,
        title: body.title,
        description: body.description,
        keywords: body.keywords,
        content: body.content,
        ownerId: body.ownerId ?? null
      })

      if (outcome.status === 'invalid-content') {
        return fail(c, 422, 'UNPROCESSABLE_ENTITY', outcome.detail)
      }

      const created = outcome.document
      // Parity with the worker's first-save path: without this, API-created
      // documents never reach the operators' new-document stream.
      setImmediate(() => {
        sendNewDocumentNotification({
          documentId: created.documentId,
          documentName: created.title || created.slug,
          slug: created.slug,
          creatorId: body.ownerId,
          createdAt: created.createdAt
        }).catch((err) => {
          documentsControllerLogger.error(
            { err, documentId: created.documentId },
            'Failed to send new document notification email'
          )
        })
      })

      const ownerProfile = body.ownerId ? await getOwnerProfile(body.ownerId) : null
      return ok(c, { ...created, ownerProfile })
    }

    const doc = await documentsService.createDocument(prisma, {
      slug: body.slug,
      title: body.title,
      description: body.description,
      keywords: body.keywords,
      userId: user?.sub ?? (serviceRole ? body.ownerId : undefined),
      email: user?.email
    })

    return ok(c, doc)
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
    return ok(c, doc)
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
    return ok(c, undefined)
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
    return ok(c, undefined)
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
      return fail(
        c,
        400,
        'BAD_REQUEST',
        'Document must be deleted before it can be permanently removed'
      )
    }
    return ok(c, undefined)
  } catch (error) {
    return handleError(c, error, { documentId })
  }
}

export const purgeTrash = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  // requireUser guarantees userId (401 upstream on a missing/invalid token), so
  // trust it like every sibling handler. The service also guards the empty-all
  // query so a missing owner can never widen the scope.
  const requesterId = c.get('userId') as string
  const { ids } = getValidJson<TrashPurgeInput>(c)

  try {
    const result = await documentsService.purgeTrash(prisma, requesterId, ids)
    return ok(c, result)
  } catch (error) {
    return handleError(c, error, { requesterId })
  }
}

export const restoreTrash = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  // Owner-scoped; { ids } required. requireUser already set userId.
  const requesterId = c.get('userId') as string
  const { ids } = getValidJson<TrashRestoreInput>(c)

  try {
    const result = await documentsService.restoreTrash(prisma, requesterId, ids)
    return ok(c, result)
  } catch (error) {
    return handleError(c, error, { requesterId })
  }
}

export const setDocumentFavorite = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const documentId = c.req.param('documentId')
  if (documentId === undefined) return c.json({ error: 'Missing document id' }, 400)
  const requesterId = c.get('userId') as string
  const { favorite } = getValidJson<SetDocumentFavoriteInput>(c)

  try {
    const result = await documentsService.setDocumentFavorite(
      prisma,
      documentId,
      requesterId,
      favorite
    )
    if (result.status === 'forbidden') return forbiddenResponse(c)
    if (result.status === 'not-found') {
      return fail(c, 404, 'NOT_FOUND', 'Document not found')
    }
    return ok(c, { documentId: result.documentId, isFavorite: result.isFavorite })
  } catch (error) {
    return handleError(c, error, { documentId })
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
      return fail(c, 404, 'NOT_FOUND', 'Document not found')
    }
    return ok(c, result.document)
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
  const prisma = c.get('prisma')
  const user = c.get('user')
  const userId = c.get('userId')

  try {
    // The path segment is the storage prefix, so a session alone parks public-read
    // bytes under an id no purge path can reach. Same gate the conversion import
    // runs. Residual: a draft anchors on editor focus, so an upload racing that
    // write by under a second 404s — allowing a row-less id reopens the hole.
    const meta = await prisma.documentMetadata.findUnique({
      where: { documentId },
      select: { ownerId: true, deletedAt: true, isPrivate: true, readOnly: true }
    })
    if (!meta || meta.deletedAt) {
      return fail(c, 404, 'NOT_FOUND', 'Document not found')
    }
    const access = resolvePrivateAccess({
      isPrivate: meta.isPrivate,
      ownerId: meta.ownerId,
      userId,
      isAnonymous: user?.is_anonymous
    })
    if (access !== 'allow') return privateGateResponse(c, access)
    if (meta.readOnly && userId !== meta.ownerId) {
      return fail(c, 403, 'FORBIDDEN', 'This document is read-only')
    }

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
