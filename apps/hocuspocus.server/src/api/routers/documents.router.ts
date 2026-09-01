import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { houseEnvelopeHook } from '../../http/envelope'
import { contentBodyLimit } from '../../modules/document-content'
import {
  createDocumentSchema,
  documentQuerySchema,
  setDocumentFavoriteSchema,
  trashPurgeSchema,
  trashRestoreSchema,
  updateDocumentMetadataSchema,
  userIdQuerySchema
} from '../../schemas/document.schema'
import * as documentsController from '../controllers/documents.controller'
import { optionalUser, requireServiceRoleOrUser, requireUser } from '../middleware/auth'

const documents = new Hono()

// Get single document by slug — optionalUser attaches the caller so the controller
// can owner-gate private docs (public stays open; anon/non-owner get a 403 hint).
documents.get(
  '/:docName',
  optionalUser,
  zValidator('query', userIdQuerySchema, houseEnvelopeHook),
  documentsController.getDocumentBySlug
)

documents.get(
  '/',
  optionalUser,
  zValidator('query', documentQuerySchema, houseEnvelopeHook),
  documentsController.listDocuments
)

documents.post(
  '/',
  requireServiceRoleOrUser,
  contentBodyLimit(),
  zValidator('json', createDocumentSchema, houseEnvelopeHook),
  documentsController.createDocument
)

documents.put(
  '/:docId',
  optionalUser,
  zValidator('json', updateDocumentMetadataSchema, houseEnvelopeHook),
  documentsController.updateDocument
)

// Bulk Trash routes — registered before the `/:documentId/*` params so the static
// `trash` segment can never be captured as a documentId (e.g. /trash/restore vs
// /:documentId/restore). Owner-scoped in the controller off the token subject.
documents.post(
  '/trash/purge',
  requireUser,
  zValidator('json', trashPurgeSchema, houseEnvelopeHook),
  documentsController.purgeTrash
)
documents.post(
  '/trash/restore',
  requireUser,
  zValidator('json', trashRestoreSchema, houseEnvelopeHook),
  documentsController.restoreTrash
)

// Permanently purge a soft-deleted document — owner-only (requireUser). Refuses a
// live doc (400) so it can never hard-delete an active one; runs the same footprint
// purge as the retention reaper. Idempotent (already-gone → success).
documents.delete('/:documentId/permanent', requireUser, documentsController.permanentDeleteDocument)

// Soft-delete a document — owner-only (requireUser); sets deletedAt. Idempotent
// on retry (a missing row is treated as already deleted).
documents.delete('/:documentId', requireUser, documentsController.deleteDocument)

documents.post('/:documentId/restore', requireUser, documentsController.restoreDocument)

documents.post('/:documentId/duplicate', requireUser, documentsController.duplicateDocument)

documents.put(
  '/:documentId/favorite',
  requireUser,
  zValidator('json', setDocumentFavoriteSchema, houseEnvelopeHook),
  documentsController.setDocumentFavorite
)

export default documents
