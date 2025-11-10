import type { PrismaClient } from '@prisma/client'
import { extractUserFromToken } from '../../utils'
import * as documentsService from '../services/documents.service'
import * as mediaService from '../services/media.service'
import { documentsControllerLogger } from '../../lib/logger'
import { getErrorResponse, AppError } from '../../lib/errors'

export const getDocumentBySlug = async (c: any) => {
  const prisma = c.get('prisma') as PrismaClient
  const docName = c.req.param('docName')
  const { userId } = c.req.valid('query')
  const token = c.req.header('token')

  const user = extractUserFromToken(token, userId)

  try {
    const doc = await documentsService.getDocumentBySlug(prisma, docName)

    if (!doc) {
      return c.json({ Success: true, data: documentsService.createDraftDocument(docName) })
    }

    return c.json({ Success: true, data: doc })
  } catch (error) {
    documentsControllerLogger.error({ err: error, docName }, 'Error fetching document')

    const statusCode = error instanceof AppError ? error.statusCode : 500
    return c.json(getErrorResponse(error as Error), statusCode)
  }
}

export const listDocuments = async (c: any) => {
  const prisma = c.get('prisma') as PrismaClient
  const {
    title,
    keywords: reqKeywords,
    description,
    limit: reqLimit,
    offset: reqOffset
  } = c.req.valid('query')

  const limit = parseInt(reqLimit, 10) || 10
  const offset = parseInt(reqOffset, 10) || 0

  try {
    const result = await documentsService.searchDocuments(prisma, {
      title,
      keywords: reqKeywords,
      description,
      limit,
      offset
    })

    return c.json({ Success: true, data: result })
  } catch (error) {
    documentsControllerLogger.error({ err: error }, 'Error listing documents')

    const statusCode = error instanceof AppError ? error.statusCode : 500
    return c.json(getErrorResponse(error as Error), statusCode)
  }
}

export const createDocument = async (c: any) => {
  const prisma = c.get('prisma') as PrismaClient
  const { title, slug, description, keywords } = c.req.valid('json')

  try {
    const doc = await documentsService.createDocument(prisma, {
      slug,
      title,
      description,
      keywords
    })

    return c.json({ Success: true, data: doc })
  } catch (error) {
    documentsControllerLogger.error({ err: error, slug }, 'Error creating document')

    const statusCode = error instanceof AppError ? error.statusCode : 500
    return c.json(getErrorResponse(error as Error), statusCode)
  }
}

export const updateDocument = async (c: any) => {
  const prisma = c.get('prisma') as PrismaClient
  const docId = c.req.param('docId')
  const { title, description, keywords, readOnly } = c.req.valid('json')

  try {
    const doc = await documentsService.updateDocument(prisma, docId, {
      title,
      description,
      keywords,
      readOnly
    })

    return c.json({ Success: true, data: doc })
  } catch (error) {
    documentsControllerLogger.error({ err: error, docId }, 'Error updating document')

    const statusCode = error instanceof AppError ? error.statusCode : 500
    return c.json(getErrorResponse(error as Error), statusCode)
  }
}

export const getMedia = async (c: any) => {
  const { documentId, mediaId } = c.req.param()

  try {
    return await mediaService.getMedia(documentId, mediaId, c)
  } catch (error) {
    documentsControllerLogger.error({ err: error, documentId, mediaId }, 'Error fetching media')

    const statusCode = error instanceof AppError ? error.statusCode : 500
    return c.json(getErrorResponse(error as Error), statusCode)
  }
}

export const uploadMedia = async (c: any) => {
  const documentId = c.req.param('documentId')

  try {
    const formData = await c.req.formData()
    const mediaFile = formData.get('mediaFile') as File

    if (!mediaFile) {
      return c.json({ error: 'No files were uploaded' }, 400)
    }

    const result = await mediaService.uploadMedia(documentId, mediaFile)
    return c.json(result, 201)
  } catch (error) {
    documentsControllerLogger.error({ err: error, documentId }, 'Error uploading file')

    const statusCode = error instanceof AppError ? error.statusCode : 500
    return c.json(getErrorResponse(error as Error), statusCode)
  }
}
