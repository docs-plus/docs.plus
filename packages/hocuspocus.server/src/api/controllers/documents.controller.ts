/**
 * Documents Controller
 *
 * Handles document CRUD operations.
 * Validation is done in the router via zValidator - controllers receive pre-validated data.
 */

import { AppError, getErrorResponse } from '../../lib/errors'
import { documentsControllerLogger } from '../../lib/logger'
import type {
  CreateDocumentInput,
  DocumentQueryInput,
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
  return c.json(
    getErrorResponse(error instanceof Error ? error : new Error(String(error))),
    statusCode
  )
}

export const getDocumentBySlug = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const docName = c.req.param('docName')

  try {
    const doc = await documentsService.getDocumentBySlug(prisma, docName)

    if (!doc) {
      return c.json({ success: true, data: documentsService.createDraftDocument(docName) })
    }

    return c.json({ success: true, data: doc })
  } catch (error) {
    return handleError(c, error, { docName })
  }
}

export const listDocuments = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const query = getValidQuery<DocumentQueryInput>(c)

  const limit = parseInt(query.limit || '10', 10)
  const offset = parseInt(query.offset || '0', 10)

  try {
    const result = await documentsService.searchDocuments(prisma, {
      title: query.title,
      keywords: query.keywords,
      description: query.description,
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

  try {
    const doc = await documentsService.createDocument(prisma, {
      slug: body.slug,
      title: body.title,
      description: body.description,
      keywords: body.keywords
    })

    return c.json({ success: true, data: doc })
  } catch (error) {
    return handleError(c, error, { slug: body.slug })
  }
}

export const updateDocument = async (c: AppContext): Promise<Response> => {
  const prisma = c.get('prisma')
  const docId = c.req.param('docId')
  const body = getValidJson<UpdateDocumentMetadataInput>(c)

  try {
    const doc = await documentsService.updateDocument(prisma, docId, body)
    return c.json({ success: true, data: doc })
  } catch (error) {
    return handleError(c, error, { docId })
  }
}

export const getMedia = async (c: AppContext): Promise<Response> => {
  const { documentId, mediaId } = c.req.param()

  try {
    return await mediaService.getMedia(documentId, mediaId, c)
  } catch (error) {
    return handleError(c, error, { documentId, mediaId })
  }
}

export const uploadMedia = async (c: AppContext): Promise<Response> => {
  const documentId = c.req.param('documentId')

  try {
    const formData = await c.req.formData()
    const mediaFile = formData.get('mediaFile')

    if (!mediaFile || typeof mediaFile === 'string') {
      return c.json({ error: 'No valid file was uploaded' }, 400)
    }

    const result = await mediaService.uploadMedia(documentId, mediaFile)
    return c.json(result, 201)
  } catch (error) {
    return handleError(c, error, { documentId })
  }
}
