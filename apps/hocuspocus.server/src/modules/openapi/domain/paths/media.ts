import {
  documentIdParamSchema,
  mediaIdParamSchema
} from '../../../../schemas/hypermultimedia.schema'
import type { OpenApiPaths } from '../../types'
import { rateLimitedRef } from '../components'
import { toParameters } from '../jsonSchema'

const tags = ['Media']

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'application/pdf'
]

export const mediaPaths: OpenApiPaths = {
  '/api/plugins/hypermultimedia/{documentId}': {
    post: {
      operationId: 'uploadMedia',
      summary: 'Upload one media file',
      description: `Backs the editor's hypermultimedia extension. Storage targets local disk when \`PERSIST_TO_LOCAL_STORAGE=true\`, otherwise S3-compatible. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}. Max size is \`DO_STORAGE_MAX_FILE_SIZE\` (default 10 MB).`,
      tags,
      security: [{ supabaseUserToken: [] }],
      parameters: toParameters(documentIdParamSchema, 'path'),
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            // Hand-written: multipart has no zod schema — the controller reads the
            // form field directly and the guards live in media.service.ts.
            schema: {
              type: 'object',
              properties: {
                mediaFile: {
                  type: 'string',
                  format: 'binary',
                  description: 'The field name is `mediaFile`, not `file`.'
                }
              },
              required: ['mediaFile']
            }
          }
        }
      },
      responses: {
        '201': {
          description:
            'Uploaded. The shape depends on the backend (`type: "s3"` or local) and includes `fileType`, `fileName` and `fileAddress`.',
          content: {
            'application/json': { schema: { type: 'object', additionalProperties: true } }
          }
        },
        '400': {
          description:
            'No `mediaFile` part (`LegacyError`), or `documentId` failed the path-charset check before the handler ran (`ZodValidationError`).',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/LegacyError' },
                  { $ref: '#/components/schemas/ZodValidationError' }
                ]
              }
            }
          }
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '413': { $ref: '#/components/responses/PayloadTooLarge' },
        '415': {
          description: 'Disallowed MIME type.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } }
          }
        },
        '429': rateLimitedRef
      }
    }
  },
  '/api/plugins/hypermultimedia/{documentId}/{mediaId}': {
    get: {
      operationId: 'getMedia',
      summary: 'Stream a media file',
      description: 'Public read — media renders inside public documents for anonymous viewers.',
      tags,
      security: [{}],
      parameters: toParameters(mediaIdParamSchema, 'path'),
      responses: {
        '200': {
          description: 'The file, served with its own `Content-Type`.',
          content: { '*/*': { schema: { type: 'string', format: 'binary' } } }
        },
        '400': { $ref: '#/components/responses/ZodValidationError' },
        '404': {
          description:
            'No such file under that document. Both storage backends emit `LegacyError`.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LegacyError' } } }
        },
        '429': rateLimitedRef
      }
    }
  }
}
