import {
  contentQuerySchema,
  documentIdParamSchema,
  patchBodySchema,
  patchQuerySchema
} from '../../../document-content/http/schema'
import type { OpenApiPaths } from '../../types'
import { rateLimitedRef } from '../components'
import { dataEnvelope, toJsonSchema, toParameters } from '../jsonSchema'

const tags = ['Document content']
const security = [{ serviceRoleKey: [] }]

const documentIdParam = toParameters(documentIdParamSchema, 'path', {
  documentId:
    'The 19-character id that is also the collaboration room name — never the slug. Resolve a slug once with `GET /api/documents/{docRef}` and keep the id.'
})

const contentErrors = {
  '400': { $ref: '#/components/responses/ValidationError' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '404': { $ref: '#/components/responses/NotFound' },
  '429': rateLimitedRef,
  '500': { $ref: '#/components/responses/InternalError' },
  '503': { $ref: '#/components/responses/ServiceUnavailable' }
}

export const documentContentPaths: OpenApiPaths = {
  '/api/documents/{documentId}/content': {
    get: {
      operationId: 'getDocumentContent',
      summary: 'Read a document body',
      description:
        'Reads the persisted head snapshot, so it can trail an actively edited document by the store debounce (10 s idle, 60 s maximum). There is no live read. A document with metadata but no snapshot returns `version: 0` and an empty doc, not an error. Content is returned verbatim — the server never sanitizes it.',
      tags,
      security,
      parameters: [...documentIdParam, ...toParameters(contentQuerySchema, 'query')],
      responses: {
        '200': {
          description: 'The persisted head.',
          content: {
            'application/json': {
              schema: dataEnvelope({ $ref: '#/components/schemas/ContentRead' })
            }
          }
        },
        ...contentErrors
      }
    },
    patch: {
      operationId: 'patchDocumentContent',
      summary: 'Apply content to a document',
      description:
        'Live and cold documents take the same path — open collaborators see the change immediately. Documents are title-first: a heading-less payload is 422. Concurrency is CRDT last-writer-wins with no `If-Match` guard. `replace` is idempotent; `append` is at-least-once under a 503 or timeout, so `GET` and verify before retrying one. A *repeated* persist-failed 500 for the same document means persistence is wedged — stop retrying and alert an operator.',
      tags,
      security,
      parameters: [...documentIdParam, ...toParameters(patchQuerySchema, 'query')],
      requestBody: {
        required: true,
        description:
          'Clear a document with `replace` and a single empty level-1 heading. Capped at 5 MiB, 50 000 nodes and 100 levels of nesting.',
        content: { 'application/json': { schema: toJsonSchema(patchBodySchema) } }
      },
      responses: {
        '200': {
          description:
            'Applied, broadcast to live collaborators and pushed into the store pipeline. This does not certify a committed database row — see the durability contract in API.md.',
          content: {
            'application/json': { schema: { type: 'object', additionalProperties: true } }
          }
        },
        '413': { $ref: '#/components/responses/PayloadTooLarge' },
        '422': { $ref: '#/components/responses/UnprocessableEntity' },
        ...contentErrors
      }
    }
  }
}
