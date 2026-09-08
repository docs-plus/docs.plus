import { zValidator } from '@hono/zod-validator'
import { Hono, type MiddlewareHandler } from 'hono'

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
import {
  defaultDocumentsController,
  type DocumentsHandlers
} from '../controllers/documents.controller'
import { optionalUser, requireServiceRoleOrUser, requireUser } from '../middleware/auth'

export interface DocumentsRouterDeps {
  controller: DocumentsHandlers
  /** Auth binds statically to Supabase over the network, so a test hands its own. */
  optionalUser: MiddlewareHandler
  requireUser: MiddlewareHandler
  requireServiceRoleOrUser: MiddlewareHandler
}

export const createDocumentsRouter = (deps: DocumentsRouterDeps): Hono => {
  const documents = new Hono()
  const { controller } = deps

  // Get single document by slug — optionalUser attaches the caller so the controller
  // can owner-gate private docs (public stays open; anon/non-owner get a 403 hint).
  documents.get(
    '/:docName',
    deps.optionalUser,
    zValidator('query', userIdQuerySchema, houseEnvelopeHook),
    controller.getDocumentBySlug
  )

  documents.get(
    '/',
    deps.optionalUser,
    zValidator('query', documentQuerySchema, houseEnvelopeHook),
    controller.listDocuments
  )

  documents.post(
    '/',
    deps.requireServiceRoleOrUser,
    contentBodyLimit(),
    zValidator('json', createDocumentSchema, houseEnvelopeHook),
    controller.createDocument
  )

  documents.put(
    '/:docId',
    deps.optionalUser,
    zValidator('json', updateDocumentMetadataSchema, houseEnvelopeHook),
    controller.updateDocument
  )

  // Bulk Trash routes — registered before the `/:documentId/*` params so the static
  // `trash` segment can never be captured as a documentId (e.g. /trash/restore vs
  // /:documentId/restore). Owner-scoped in the controller off the token subject.
  documents.post(
    '/trash/purge',
    deps.requireUser,
    zValidator('json', trashPurgeSchema, houseEnvelopeHook),
    controller.purgeTrash
  )
  documents.post(
    '/trash/restore',
    deps.requireUser,
    zValidator('json', trashRestoreSchema, houseEnvelopeHook),
    controller.restoreTrash
  )

  // Permanently purge a soft-deleted document — owner-only (requireUser). Refuses a
  // live doc (400) so it can never hard-delete an active one; runs the same footprint
  // purge as the retention reaper. Idempotent (already-gone → success).
  documents.delete('/:documentId/permanent', deps.requireUser, controller.permanentDeleteDocument)

  // Soft-delete a document — owner-only (requireUser); sets deletedAt. Idempotent
  // on retry (a missing row is treated as already deleted).
  documents.delete('/:documentId', deps.requireUser, controller.deleteDocument)

  documents.post('/:documentId/restore', deps.requireUser, controller.restoreDocument)

  documents.post('/:documentId/duplicate', deps.requireUser, controller.duplicateDocument)

  documents.post('/:documentId/opened', deps.requireUser, controller.touchDocumentOpened)

  documents.put(
    '/:documentId/favorite',
    deps.requireUser,
    zValidator('json', setDocumentFavoriteSchema, houseEnvelopeHook),
    controller.setDocumentFavorite
  )

  return documents
}

export default createDocumentsRouter({
  controller: defaultDocumentsController,
  optionalUser,
  requireUser,
  requireServiceRoleOrUser
})
