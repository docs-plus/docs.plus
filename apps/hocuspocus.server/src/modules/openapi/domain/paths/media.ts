import {
  ALLOWED_MIME_TYPES,
  documentIdParamSchema,
  mediaIdParamSchema
} from '../../../../schemas/hypermultimedia.schema'
import type { OpenApiPaths } from '../../types'
import { envelopeOrLegacyResponse, rateLimitedRef } from '../components'
import { DOCUMENT_ID_NOTE, toParameters } from '../jsonSchema'

const tags = ['Media']

export const mediaPaths: OpenApiPaths = {
  '/api/plugins/hypermultimedia/{documentId}': {
    post: {
      operationId: 'uploadMedia',
      summary: 'Upload one media file',
      description: `Backs the editor's hypermultimedia extension. Storage targets local disk when \`PERSIST_TO_LOCAL_STORAGE=true\`, otherwise S3-compatible. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}. Max size is \`DO_STORAGE_MAX_FILE_SIZE\` (default 10 MB).`,
      tags,
      security: [{ supabaseUserToken: [] }],
      parameters: toParameters(documentIdParamSchema, 'path', { documentId: DOCUMENT_ID_NOTE }),
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
        '400': envelopeOrLegacyResponse(
          'No `mediaFile` part (`LegacyError`), or `documentId` failed the path-charset check before the handler ran (`ErrorEnvelope`).'
        ),
        '401': { $ref: '#/components/responses/Unauthorized' },
        // `access` is optional here, unlike the slug read: the read-only arm
        // returns a plain envelope, and only the privacy arm carries the hint.
        '403': {
          description:
            'Private document and the caller is not its owner, or the document is read-only and the caller is not its owner.',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ErrorEnvelope' },
                  {
                    type: 'object',
                    properties: {
                      access: { type: 'string', enum: ['sign-in-required', 'denied'] }
                    }
                  }
                ]
              }
            }
          }
        },
        '404': { $ref: '#/components/responses/NotFound' },
        '413': {
          description:
            'Body exceeds `DO_STORAGE_MAX_FILE_SIZE` (default 10 MB) plus a 1 MiB margin for the multipart envelope. This is the media cap, not the 5 MiB content cap.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } }
          }
        },
        '415': {
          description: 'Disallowed MIME type.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } }
          }
        },
        '429': rateLimitedRef,
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
      }
    }
  },
  '/api/plugins/hypermultimedia/{documentId}/{mediaId}': {
    get: {
      operationId: 'getMedia',
      summary: 'Stream a media file',
      description:
        "Public read for a public document, so its media renders for anonymous viewers. A Private document's media serves only with its owner's `dp_media` cookie (see `createMediaSession`), with `Cache-Control: private, no-cache`.",
      tags,
      security: [{}],
      parameters: toParameters(mediaIdParamSchema, 'path', { documentId: DOCUMENT_ID_NOTE }),
      responses: {
        '200': {
          description: 'The file, served with its own `Content-Type`.',
          content: { '*/*': { schema: { type: 'string', format: 'binary' } } }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '404': envelopeOrLegacyResponse(
          "A document in Trash, or a Private document read without its owner's cookie, answers `ErrorEnvelope` with code `NOT_FOUND`, before storage is read. A missing file answers `LegacyError` from either storage backend."
        ),
        '429': rateLimitedRef
      }
    }
  },
  '/api/plugins/hypermultimedia/session': {
    post: {
      operationId: 'createMediaSession',
      summary: 'Set the Private media cookie',
      description:
        "Trades the caller's token for the `HttpOnly` `dp_media` cookie (one hour, `SameSite=Lax`, path `/api/plugins/hypermultimedia`). The webapp posts it after sign-in and on each token refresh, because an image request carries no token.",
      tags,
      security: [{ supabaseUserToken: [] }],
      responses: {
        '204': { description: 'Cookie set.' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': {
          description: 'An anonymous user cannot load Private media.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } }
          }
        },
        '429': rateLimitedRef,
        '503': {
          description: '`MEDIA_COOKIE_SECRET` is not set, so Private media is off.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } }
          }
        }
      }
    },
    delete: {
      operationId: 'clearMediaSession',
      summary: 'Expire the Private media cookie',
      description:
        'No auth, because a signed-out page has no token and JavaScript cannot clear an `HttpOnly` cookie.',
      tags,
      security: [{}],
      responses: {
        '204': { description: 'Cookie expired.' },
        '429': rateLimitedRef
      }
    }
  }
}
