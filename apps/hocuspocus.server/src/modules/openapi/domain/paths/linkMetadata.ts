import { metadataQuerySchema } from '../../../link-metadata/http/schema'
import type { OpenApiPaths } from '../../types'
import { rateLimitedRef } from '../components'
import { toParameters } from '../jsonSchema'

export const linkMetadataPaths: OpenApiPaths = {
  '/api/metadata': {
    get: {
      operationId: 'getLinkMetadata',
      summary: 'Unfurl a URL',
      description:
        "Runs a cache → oEmbed → host-handler → HTML-scrape pipeline with SSRF protection. Honors `Accept-Language`. Responses set `Cache-Control` (positive for hits, short negative for fallbacks) and `Vary: Accept-Language`. Errors use this module's own top-level `code` / `message` shape, not the house envelope.",
      tags: ['Link metadata'],
      security: [{}],
      // The zod `.refine()` scheme guard has no JSON Schema equivalent, so it is
      // stated here rather than lost silently in translation.
      parameters: toParameters(metadataQuerySchema, 'query', {
        url: 'Required. Must use the http(s) scheme and be at most 2048 characters.'
      }),
      responses: {
        '200': {
          description: 'Unfurled metadata.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LinkMetadata' } }
          },
          headers: {
            'Cache-Control': { schema: { type: 'string' } },
            Vary: { schema: { type: 'string' } }
          }
        },
        '400': {
          description:
            'Malformed URL (`INVALID_URL`) or blocked by the SSRF guard (`BLOCKED_URL`).',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LinkMetadataError' } }
          }
        },
        '429': rateLimitedRef
      }
    }
  }
}
