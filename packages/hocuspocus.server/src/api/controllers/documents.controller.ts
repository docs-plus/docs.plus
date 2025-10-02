import type { Context } from 'hono'
import type { PrismaClient } from '@prisma/client'
import { jwtDecode } from 'jwt-decode'
import * as documentsService from '../services/documents.service'
import * as mediaService from '../services/media.service'

const extractUser = (token?: string, userId?: string) => {
  if (!token || !userId) return null

  try {
    const decoded = jwtDecode(token)
    return { ...decoded, id: userId }
  } catch (error) {
    console.error('JWT decode error:', error)
    return null
  }
}

export const getDocumentBySlug = async (c: any) => {
  const prisma = c.get('prisma') as PrismaClient
  const docName = c.req.param('docName')
  const { userId } = c.req.valid('query')
  const token = c.req.header('token')

  const user = extractUser(token, userId)

  try {
    const doc = await documentsService.getDocumentBySlug(prisma, docName)

    if (!doc) {
      return c.json({ Success: true, data: documentsService.createDraftDocument(docName) })
    }

    return c.json({ Success: true, data: doc })
  } catch (error) {
    console.error('Error fetching document:', error)
    return c.json({ Success: false, Error: error }, 400)
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
    console.error('Error listing documents:', error)
    return c.json({ Success: false, Error: error }, 400)
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
    console.error('Error creating document:', error)
    return c.json({ Success: false, Error: error }, 400)
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
    console.error('Error updating document:', error)
    return c.json({ Success: false, Error: error }, 400)
  }
}

export const getMedia = async (c: any) => {
  const { documentId, mediaId } = c.req.param()

  try {
    return await mediaService.getMedia(documentId, mediaId, c)
  } catch (error) {
    console.error('Error fetching media:', error)
    return c.json({ error: 'Failed to fetch media' }, 500)
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
    console.error('Error uploading file:', error)
    return c.json({ error: 'Upload failed' }, 500)
  }
}
