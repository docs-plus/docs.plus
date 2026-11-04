import {
  createDocumentSchema,
  documentIdField,
  documentQuerySchema,
  setDocumentFavoriteSchema,
  trashPurgeSchema,
  trashRestoreSchema,
  updateDocumentMetadataSchema,
  userIdQuerySchema
} from '../../../../schemas/document.schema'
import { MAX_DUPLICATE_MEDIA_OBJECTS } from '../../../../schemas/hypermultimedia.schema'
import { MAX_TERM_CHARS } from '../../../social-card/domain/cardRequest'
import { HOVERCARD_LIST, HOVERCARD_MAX_TERMS } from '../../../social-card/domain/hovercard'
import type {
  JsonSchema,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiPaths,
  SecurityRequirement
} from '../../types'
import { envelopeResponse, rateLimitedRef } from '../components'
import {
  dataEnvelope,
  DOCUMENT_ID_NOTE,
  pathParam,
  toJsonSchema,
  toParameters
} from '../jsonSchema'

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
  description: string,
  extraResponses: Record<string, unknown> = {}
): OpenApiOperation => ({
  operationId,
  summary,
  description,
  tags,
  security: requireUserSecurity,
  parameters: [pathParam('documentId', DOCUMENT_ID_NOTE)],
  responses: {
    '200': okEnvelope('Applied.', { type: 'object', additionalProperties: true }),
    '401': { $ref: '#/components/responses/Unauthorized' },
    '403': { $ref: '#/components/responses/Forbidden' },
    '404': { $ref: '#/components/responses/NotFound' },
    '429': rateLimitedRef,
    '503': { $ref: '#/components/responses/ServiceUnavailable' },
    ...extraResponses
  }
})

const query = (
  name: string,
  description: string,
  schema: JsonSchema = { type: 'string' }
): OpenApiParameter => ({
  name,
  in: 'query',
  required: false,
  description,
  schema
})

/** The social card sub-ids. The slug read and the card image URL take the same keys. */
const cardQueryParams: OpenApiParameter[] = [
  query('id', 'Heading `toc-id` from the pad link (`id=`): a Heading card.'),
  query('c', 'Chat room link id, a channel id or a heading id (`chatroom=`).'),
  query('m', 'Message id (`msg_id=`), read only with `c`: a Message card.'),
  query('t', 'One filter term per value, at most 4: a Filter card.', {
    type: 'array',
    items: { type: 'string' }
  }),
  query('mode', 'Filter mode; only `and` is carried.', { type: 'string', enum: ['and'] }),
  query('version', 'History version number: a Version card.', { type: 'integer', minimum: 1 })
]

const socialCard: JsonSchema = {
  type: 'object',
  description:
    'Sent only when the read asked with `card=1` and the pad has a card. The page head points `og:image` at `GET /api/documents/{documentId}/card.png?{query}`.',
  properties: {
    query: { type: 'string', description: 'The card image query string, `v` included.' },
    title: { type: ['string', 'null'], description: '`og:title`; null keeps the Pad title.' },
    alt: { type: 'string', description: 'Image alt text, from drawn values only.' },
    path: { type: 'string', description: '`og:url` path for this card.' }
  },
  required: ['query', 'title', 'alt', 'path']
}

export const documentsPaths: OpenApiPaths = {
  '/api/documents': {
    get: {
      operationId: 'listDocuments',
      summary: 'List or search documents',
      description:
        "Full-text search when any of `title` / `keywords` / `description` is present, otherwise a plain list. Without a verified `ownerId === token.sub` requester, private rows are clamped out of both the page and `total`. `deleted=true` is the caller's own Trash and requires a token. An Owner live list pins that user's Favorites first, then applies `sort`. Those rows include `isFavorite`, `preview`, and `lastOpenedAt`. Owner Trash includes `preview` and `lastOpenedAt` and omits `isFavorite`. The public fleet omits all three. `scope=all` adds the caller's joined rows, which are always public and live; `scope=joined` lists only those. A row the caller does not own never carries `lastOpenedAt` or `isFavorite`, and every row carries `isOwner`.",
      tags,
      security: optionalUserSecurity,
      parameters: toParameters(documentQuerySchema, 'query', {
        ownerId: 'Requires a matching `token` header; a mismatch against the JWT subject is a 403.',
        scope:
          'Requires a `token` header. Absent keeps the legacy owner or fleet list. With `deleted=true` it is a 400. A failed membership read is a 503.',
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
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
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
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '409': { $ref: '#/components/responses/Conflict' },
        '413': { $ref: '#/components/responses/PayloadTooLarge' },
        '422': { $ref: '#/components/responses/UnprocessableEntity' },
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
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
        }),
        query(
          'card',
          '`1` asks for the social preview card. The webapp sends it on a full page load only.',
          { type: 'string', enum: ['1'] }
        ),
        ...cardQueryParams
      ],
      responses: {
        '200': okEnvelope('Document metadata, or a synthesized draft.', {
          allOf: [
            { $ref: '#/components/schemas/DocumentSummary' },
            { type: 'object', properties: { card: socialCard } }
          ]
        }),
        '400': { $ref: '#/components/responses/ValidationError' },
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
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
      }
    },
    put: {
      operationId: 'updateDocumentMetadata',
      summary: 'Upsert document metadata',
      description:
        "Addressed by **`documentId`**. Every field is optional. `readOnly` and `isPrivate` are owner-only — a non-owner's change to either is silently ignored and logged server-side. `slug` is used only when the row is created; it never renames a document.",
      tags,
      security: optionalUserSecurity,
      parameters: [
        pathParam(
          'docRef',
          'The `documentId` (19 characters for a new document).',
          toJsonSchema(documentIdField)
        )
      ],
      requestBody: jsonBody(toJsonSchema(updateDocumentMetadataSchema)),
      responses: {
        '200': okEnvelope('The updated document.', {
          $ref: '#/components/schemas/DocumentSummary'
        }),
        '400': { $ref: '#/components/responses/ValidationError' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
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
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
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
  '/api/documents/{documentId}/favorite': {
    put: {
      operationId: 'setDocumentFavorite',
      summary: 'Favorite or unfavorite a document',
      description:
        'Owner-only. Writes a `DocumentFavorite` row for the token subject. Soft-deleted documents are 404. The join row survives a later soft-delete so restore stays favorited.',
      tags,
      security: requireUserSecurity,
      parameters: [pathParam('documentId', DOCUMENT_ID_NOTE)],
      requestBody: jsonBody(toJsonSchema(setDocumentFavoriteSchema)),
      responses: {
        '200': okEnvelope('The new favorite state.', {
          type: 'object',
          properties: {
            documentId: { type: 'string' },
            isFavorite: { type: 'boolean' }
          },
          required: ['documentId', 'isFavorite']
        }),
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
      }
    }
  },
  '/api/documents/{documentId}/opened': {
    post: ownedLifecycle(
      'touchDocumentOpened',
      'Record that the owner opened a document',
      'Owner-only. Sets `lastOpenedAt` with raw SQL so `@updatedAt` does not move. Soft-deleted documents are 404. Writes more than 30 seconds apart; a closer repeat is a no-op success.'
    )
  },
  '/api/documents/{documentId}/duplicate': {
    post: ownedLifecycle(
      'duplicateDocument',
      'Duplicate a document',
      `Owner-only. Copies the source's latest Yjs bytes into a fresh owner-owned document; the slug is \`<title> (copy)\`, uniquified. Media is cloned, not shared: the source's objects are copied under the copy's own prefix and the snapshot's URLs repointed there, so purging either document leaves the other intact. Capped at ${MAX_DUPLICATE_MEDIA_OBJECTS} media objects. Media under a document in Trash is not copied and does not count. A soft-deleted source is a 404.`,
      {
        '413': envelopeResponse(
          `The source's snapshot names more than ${MAX_DUPLICATE_MEDIA_OBJECTS} media objects outside Trash. Each one is copied inside the request, so the count is refused up front rather than left to time out.`
        )
      }
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
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
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
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
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
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
      }
    }
  },
  '/api/documents/{docName}/hovercard': {
    get: {
      operationId: 'getPadHovercard',
      summary: 'Link hovercard for one pad link',
      description:
        'Reads by slug and never drafts. A Private pad answers `{ locked: true }` to anyone but its owner, and also when Auth is unreachable; nothing else is read then. The query keys pick one link kind, in the order the app uses: `version`, `history=1`, `terms` (filter), `msg_id` with `chatroom` (message), `chatroom` (chat), `id` (heading), else the pad. A key with a bad shape is dropped, and the next kind answers. An unknown heading, room, message or version, a failed chat read on a chat or message link, or a head over 1 MiB for a filter, answers the pad kind. On a heading link a failed chat read leaves `messages` out. Chat facts are counts and dates only: no message text, author or user id. Every reply sends `Cache-Control: private, no-store`, because the answer depends on the reader.',
      tags,
      security: optionalUserSecurity,
      parameters: [
        pathParam('docName', 'The document **slug**.'),
        query('id', 'Heading `toc-id` (`id=` in the pad link).'),
        query('chatroom', 'Chat room link id: a heading `toc-id` or a channel id.'),
        query('msg_id', 'Message uuid, read only with `chatroom`.'),
        query(
          'terms',
          `One filter term per \`terms\` key, as in the pad URL path. At most ${HOVERCARD_MAX_TERMS}, each at most ${MAX_TERM_CHARS} characters.`,
          { type: 'array', items: { type: 'string' } }
        ),
        query('mode', 'Filter mode. A missing value is `or`, as in the app.', {
          type: 'string',
          enum: ['and', 'or']
        }),
        query('version', 'History version number.', { type: 'integer', minimum: 1 }),
        query('history', 'The History link.', { type: 'string', enum: ['1'] })
      ],
      responses: {
        '200': okEnvelope('The card for the link kind, or a locked notice.', {
          oneOf: [
            {
              type: 'object',
              properties: { locked: { type: 'boolean', enum: [true] } },
              required: ['locked']
            },
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['pad'] },
                title: { type: 'string' },
                sections: { type: 'array', items: { type: 'string' }, maxItems: HOVERCARD_LIST },
                total: { type: 'integer', minimum: 0 }
              },
              required: ['kind', 'title', 'sections', 'total']
            },
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['heading'] },
                padTitle: { type: 'string' },
                title: { type: 'string' },
                trail: { type: 'array', items: { type: 'string' } },
                subsections: { type: 'integer', minimum: 0 },
                lines: { type: 'array', items: { type: 'string' }, maxItems: HOVERCARD_LIST },
                messages: {
                  type: 'integer',
                  minimum: 0,
                  description: 'Left out when the chat read failed.'
                }
              },
              required: ['kind', 'padTitle', 'title', 'trail', 'subsections', 'lines']
            },
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['chat'] },
                padTitle: { type: 'string' },
                heading: { type: 'string' },
                trail: { type: 'array', items: { type: 'string' } },
                messages: { type: 'integer', minimum: 0 },
                lastMessageAt: { type: 'string', format: 'date-time' }
              },
              required: ['kind', 'padTitle', 'heading', 'trail', 'messages']
            },
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['message'] },
                padTitle: { type: 'string' },
                heading: { type: 'string' },
                trail: { type: 'array', items: { type: 'string' } },
                sentAt: { type: 'string', format: 'date-time' },
                replies: { type: 'integer', minimum: 0 },
                reactions: { type: 'integer', minimum: 0 }
              },
              required: ['kind', 'padTitle', 'heading', 'trail', 'sentAt', 'replies', 'reactions']
            },
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['filter'] },
                padTitle: { type: 'string' },
                terms: { type: 'array', items: { type: 'string' } },
                mode: { type: 'string', enum: ['and', 'or'] },
                shown: { type: 'array', items: { type: 'string' }, maxItems: HOVERCARD_LIST },
                shownCount: { type: 'integer', minimum: 0 },
                total: { type: 'integer', minimum: 0 }
              },
              required: ['kind', 'padTitle', 'terms', 'mode', 'shown', 'shownCount', 'total']
            },
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['version'] },
                padTitle: { type: 'string' },
                version: { type: 'integer', minimum: 1 },
                name: { type: 'string' },
                savedAt: { type: 'string', format: 'date-time' },
                sectionsChanged: { type: 'integer', minimum: 0 },
                wordsAdded: { type: 'integer', minimum: 0 },
                wordsRemoved: { type: 'integer', minimum: 0 }
              },
              required: ['kind', 'padTitle', 'version', 'savedAt']
            },
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['history'] },
                padTitle: { type: 'string' },
                versions: { type: 'integer', minimum: 0 },
                lastSavedAt: { type: 'string', format: 'date-time' }
              },
              required: ['kind', 'padTitle', 'versions']
            }
          ]
        }),
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': { $ref: '#/components/responses/NotFound' },
        '429': rateLimitedRef,
        '500': { $ref: '#/components/responses/InternalError' }
      }
    }
  },
  '/api/documents/{documentId}/card.png': {
    get: {
      operationId: 'getSocialCardImage',
      summary: 'Social preview card image',
      description:
        'A 1200 × 630 PNG drawn from stored values only. Kinds turn on with `SOCIAL_CARD_KINDS`. `v` is a cache key only; the server computes its own, which is also the `ETag`. Every refusal (Private, deleted, ownerless, missing, bad id shape) is the same `404`, so the route never tells a Private pad from a missing one. The route answers `302` to the static Fallback image, never `5xx`, in four cases. The cases are a kind that is off, a full render queue, a chat read that failed for now, and a render error. Rate-limited by its own bucket.',
      tags,
      security: [{}],
      parameters: [
        pathParam('documentId', DOCUMENT_ID_NOTE),
        ...cardQueryParams,
        query('v', 'The card version from the slug read. Ignored by the server.')
      ],
      responses: {
        '200': {
          description: 'The card. `Cache-Control: public, max-age=3600`, `X-Robots-Tag: noindex`.',
          content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
          headers: {
            'Cache-Control': { schema: { type: 'string' } },
            ETag: { schema: { type: 'string' } }
          }
        },
        '302': {
          description: 'The static Fallback image, `Cache-Control: public, max-age=300`.',
          headers: { Location: { schema: { type: 'string', format: 'uri' } } }
        },
        '304': { description: '`If-None-Match` equals the current `ETag`.' },
        '404': {
          description: 'No card for this id. One body and header set for every refusal.',
          content: { 'text/plain': { schema: { type: 'string' } } }
        },
        '429': rateLimitedRef
      }
    }
  }
}
