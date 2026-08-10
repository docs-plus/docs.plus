import {
  createDocumentSchema,
  documentQuerySchema,
  trashPurgeSchema,
  trashRestoreSchema,
  updateDocumentMetadataSchema,
  userIdQuerySchema
} from '../../../../schemas/document.schema'
import type { JsonSchema, OpenApiOperation, OpenApiPaths, SecurityRequirement } from '../../types'
import { rateLimitedRef } from '../components'
import { dataEnvelope, pathParam, toJsonSchema, toParameters } from '../jsonSchema'

const tags = ['Documents']

/** `optionalUser` never rejects, so anonymous is a valid credential set here. */
const optionalUserSecurity: SecurityRequirement[] = [{}, { supabaseUserToken: [] }]
const requireUserSecurity: SecurityRequirement[] = [{ supabaseUserToken: [] }]

const jsonBody = (schema: JsonSchema) => ({
  required: true,
  content: { 'application/json': { schema } }
})

const okEnvelope = (description: string, data: JsonSchema) => ({
  description,
  content: { 'application/json': { schema: dataEnvelope(data) } }
})

const ownedLifecycle = (
  operationId: string,
  summary: string,
  description: string
): OpenApiOperation => ({
  operationId,
  summary,
  description,
  tags,
  security: requireUserSecurity,
  parameters: [pathParam('documentId', 'The 19-character document id.')],
  responses: {
    '200': okEnvelope('Applied.', { type: 'object', additionalProperties: true }),
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
    '404': { $ref: '#/components/responses/NotFound' },
    '429': rateLimitedRef
  }
})

export const documentsPaths: OpenApiPaths = {
  '/api/documents': {
    get: {
      operationId: 'listDocuments',
      summary: 'List or search documents',
      description:
        "Full-text search when any of `title` / `keywords` / `description` is present, otherwise a plain list. Without a verified `ownerId === token.sub` requester, private rows are clamped out of both the page and `total`. `deleted=true` is the caller's own Trash and requires a token.",
      tags,
      security: optionalUserSecurity,
      parameters: toParameters(documentQuerySchema, 'query', {
        ownerId: 'Requires a matching `token` header; a mismatch against the JWT subject is a 403.',
        sort: 'Allowlisted; an unknown value falls back to `updatedAt_desc`.',
        limit: 'Page size, 1–100. Out of range is a 400 from the service, not the validator.',
        offset: 'Pagination offset, >= 0. Out of range is a 400 from the service.'
      }),
      responses: {
        '200': okEnvelope('A page of documents.', {
          $ref: '#/components/schemas/DocumentListPage'
        }),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '429': rateLimitedRef
      }
    },
    post: {
      operationId: 'createDocument',
      summary: 'Create a document',
      description:
        '`content` and `ownerId` are accepted only under the service-role key — a user JWT presenting either gets 403 and nothing is written. With `content`, the encode runs first and the metadata row plus version 1 are written in one transaction.',
      tags,
      security: [{ supabaseUserToken: [] }, { serviceRoleKey: [] }],
      requestBody: jsonBody(toJsonSchema(createDocumentSchema)),
      responses: {
        '200': okEnvelope('The created document.', {
          $ref: '#/components/schemas/DocumentSummary'
        }),
        '400': { $ref: '#/components/responses/ZodValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '409': { $ref: '#/components/responses/Conflict' },
        '413': { $ref: '#/components/responses/PayloadTooLarge' },
        '422': { $ref: '#/components/responses/UnprocessableEntity' },
        '429': rateLimitedRef
      }
    }
  },
  // One template for three operations: OpenAPI forbids two paths that differ only
  // in a parameter name. This segment really is a slug on GET and an id on
  // PUT/DELETE. `docRef` names the union honestly.
  '/api/documents/{docRef}': {
    get: {
      operationId: 'getDocumentBySlug',
      summary: 'Fetch one document by slug',
      description:
        'An unmatched slug returns a synthesized draft with no `id` or `createdAt` rather than a 404, which is how a mistyped slug is detected. A *soft-deleted* slug is the one 404 case — drafting it would mint a new `documentId` under a still-unique slug and collide on persist. Public documents are open to anyone; private ones are owner-only. The 403 body carries a top-level `access` hint of `sign-in-required` (anonymous, or `ownerId: null`) or `denied` (signed-in non-owner).',
      tags,
      security: optionalUserSecurity,
      parameters: [
        pathParam('docRef', 'The document **slug**.'),
        ...toParameters(userIdQuerySchema, 'query', {
          userId: 'Accepted for access context; owner identity always comes from the token subject.'
        })
      ],
      responses: {
        '200': okEnvelope('Document metadata, or a synthesized draft.', {
          $ref: '#/components/schemas/DocumentSummary'
        }),
        '400': { $ref: '#/components/responses/ZodValidationError' },
        '403': {
          description: 'Private document, and the caller is not its owner.',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ErrorEnvelope' },
                  {
                    type: 'object',
                    properties: {
                      access: { type: 'string', enum: ['sign-in-required', 'denied'] }
                    },
                    required: ['access']
                  }
                ]
              }
            }
          }
        },
        '404': { $ref: '#/components/responses/NotFound' },
        '429': rateLimitedRef
      }
    },
    put: {
      operationId: 'updateDocumentMetadata',
      summary: 'Upsert document metadata',
      description:
        "Addressed by **`documentId`**. Every field is optional. `readOnly` and `isPrivate` are owner-only — a non-owner's change to either is silently ignored and logged server-side. `slug` is used only when the row is created; it never renames a document.",
      tags,
      security: optionalUserSecurity,
      parameters: [pathParam('docRef', 'The 19-character `documentId`.')],
      requestBody: jsonBody(toJsonSchema(updateDocumentMetadataSchema)),
      responses: {
        '200': okEnvelope('The updated document.', {
          $ref: '#/components/schemas/DocumentSummary'
        }),
        '400': { $ref: '#/components/responses/ZodValidationError' },
        '429': rateLimitedRef
      }
    },
    delete: {
      operationId: 'deleteDocument',
      summary: 'Soft-delete a document',
      description:
        'Owner-only. Stamps `deletedAt`; the row survives for restore and is reaped after `DOC_DELETE_RETENTION_DAYS` (default 30). Idempotent — a missing row returns success.',
      tags,
      security: requireUserSecurity,
      parameters: [pathParam('docRef', 'The 19-character `documentId`.')],
      responses: {
        '200': okEnvelope('Deleted, or already gone.', {
          type: 'object',
          additionalProperties: true
        }),
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '429': rateLimitedRef
      }
    }
  },
  '/api/documents/{documentId}/restore': {
    post: ownedLifecycle(
      'restoreDocument',
      'Restore a soft-deleted document',
      'Owner-only. Clears `deletedAt`. Idempotent.'
    )
  },
  '/api/documents/{documentId}/duplicate': {
    post: ownedLifecycle(
      'duplicateDocument',
      'Duplicate a document',
      "Owner-only. Copies the source's latest Yjs bytes into a fresh owner-owned document; the slug is `<title> (copy)`, uniquified. Media is cloned, not shared: the source's objects are copied under the copy's own prefix and the snapshot's URLs repointed there, so purging either document leaves the other intact. A soft-deleted source is a 404."
    )
  },
  '/api/documents/{documentId}/permanent': {
    delete: {
      ...ownedLifecycle(
        'permanentDeleteDocument',
        'Purge a soft-deleted document',
        'Owner-only. Removes chat and views via the `purge_document_footprint` RPC, editor media via a storage-prefix delete, then the metadata row. Refuses a live document with 400. Idempotent.'
      ),
      responses: {
        '200': okEnvelope('Purged, or already gone.', {
          type: 'object',
          additionalProperties: true
        }),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '429': rateLimitedRef
      }
    }
  },
  '/api/documents/trash/purge': {
    post: {
      operationId: 'purgeTrash',
      summary: 'Bulk permanent-delete from Trash',
      description:
        'Owner-only. Omit `ids` to empty the whole trash, or pass a selection capped at 500. Runs the per-document purge sequentially, so a very large trash can exceed the request timeout.',
      tags,
      security: requireUserSecurity,
      requestBody: jsonBody(toJsonSchema(trashPurgeSchema)),
      responses: {
        '200': okEnvelope('Purge count.', {
          type: 'object',
          properties: { purged: { type: 'integer' } },
          required: ['purged']
        }),
        '400': { $ref: '#/components/responses/ZodValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': rateLimitedRef
      }
    }
  },
  '/api/documents/trash/restore': {
    post: {
      operationId: 'restoreTrash',
      summary: 'Bulk restore from Trash',
      description: 'Owner-only. Non-owned ids are skipped rather than rejected.',
      tags,
      security: requireUserSecurity,
      requestBody: jsonBody(toJsonSchema(trashRestoreSchema)),
      responses: {
        '200': okEnvelope('Restore count.', {
          type: 'object',
          properties: { restored: { type: 'integer' } },
          required: ['restored']
        }),
        '400': { $ref: '#/components/responses/ZodValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': rateLimitedRef
      }
    }
  }
}
