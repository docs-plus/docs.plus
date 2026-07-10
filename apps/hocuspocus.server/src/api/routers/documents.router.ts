import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import {
  createDocumentSchema,
  documentQuerySchema,
  trashPurgeSchema,
  trashRestoreSchema,
  updateDocumentMetadataSchema,
  userIdQuerySchema
} from '../../schemas/document.schema'
import * as documentsController from '../controllers/documents.controller'
import { optionalUser, requireUser } from '../middleware/auth'

const documents = new Hono()

// Get single document by slug — optionalUser attaches the caller so the controller
// can owner-gate private docs (public stays open; anon/non-owner get a 403 hint).
documents.get(
  '/:docName',
  optionalUser,
  zValidator('query', userIdQuerySchema),
  documentsController.getDocumentBySlug
)

// List documents with search — optionalUser attaches the caller when a token is present.
documents.get(
  '/',
  optionalUser,
  zValidator('query', documentQuerySchema),
  documentsController.listDocuments
)

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

// Bulk Trash routes — registered before the `/:documentId/*` params so the static
// `trash` segment can never be captured as a documentId (e.g. /trash/restore vs
// /:documentId/restore). Owner-scoped in the controller off the token subject.
documents.post(
  '/trash/purge',
  requireUser,
  zValidator('json', trashPurgeSchema),
  documentsController.purgeTrash
)
documents.post(
  '/trash/restore',
  requireUser,
  zValidator('json', trashRestoreSchema),
  documentsController.restoreTrash
)

// Permanently purge a soft-deleted document — owner-only (requireUser). Refuses a
// live doc (400) so it can never hard-delete an active one; runs the same footprint
// purge as the retention reaper. Idempotent (already-gone → success).
documents.delete('/:documentId/permanent', requireUser, documentsController.permanentDeleteDocument)

// Soft-delete a document — owner-only (requireUser); sets deletedAt. Idempotent
// on retry (a missing row is treated as already deleted).
documents.delete('/:documentId', requireUser, documentsController.deleteDocument)

// Restore a soft-deleted document — owner-only (requireUser); clears deletedAt.
documents.post('/:documentId/restore', requireUser, documentsController.restoreDocument)

// Duplicate a document — owner-only (requireUser); copies latest bytes into a
// fresh doc owned by the caller. Media is shared, not cloned.
documents.post('/:documentId/duplicate', requireUser, documentsController.duplicateDocument)

export default documents
