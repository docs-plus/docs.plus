import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import {
  createDocumentSchema,
  documentQuerySchema,
  updateDocumentMetadataSchema,
  userIdQuerySchema
} from '../../schemas/document.schema'
import * as documentsController from '../controllers/documents.controller'
import { optionalUser, requireUser } from '../middleware/auth'

const documents = new Hono()

// Get single document by slug
documents.get(
  '/:docName',
  zValidator('query', userIdQuerySchema),
  documentsController.getDocumentBySlug
)

// List documents with search
documents.get('/', zValidator('query', documentQuerySchema), documentsController.listDocuments)

// Create new document — authenticated; the caller becomes the owner.
documents.post(
  '/',
  requireUser,
  zValidator('json', createDocumentSchema),
  documentsController.createDocument
)

// Update document metadata — title/description are collaborative; the readOnly
// lock is owner-gated in the service (optionalUser attaches the caller if known).
documents.put(
  '/:docId',
  optionalUser,
  zValidator('json', updateDocumentMetadataSchema),
  documentsController.updateDocument
)

export default documents
