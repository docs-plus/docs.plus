import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import * as documentsController from '../controllers/documents.controller'
import {
  createDocumentSchema,
  updateDocumentMetadataSchema,
  documentQuerySchema,
  userIdQuerySchema
} from '../../schemas/document.schema'

const documents = new Hono()

// Get single document by slug
documents.get(
  '/:docName',
  zValidator('query', userIdQuerySchema),
  documentsController.getDocumentBySlug
)

// List documents with search
documents.get('/', zValidator('query', documentQuerySchema), documentsController.listDocuments)

// Create new document
documents.post('/', zValidator('json', createDocumentSchema), documentsController.createDocument)

// Update document metadata
documents.put(
  '/:docId',
  zValidator('json', updateDocumentMetadataSchema),
  documentsController.updateDocument
)

export default documents
