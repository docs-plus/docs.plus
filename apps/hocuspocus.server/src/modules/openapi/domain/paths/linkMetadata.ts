import { iconQuerySchema, metadataQuerySchema } from '../../../link-metadata/http/schema'
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
  },
  '/api/metadata/icon': {
    get: {
      operationId: 'getLinkIcon',
      summary: 'Fetch a favicon',
      description:
        'Fetches `<origin>/favicon.ico` through the SSRF guard, with a 3 s budget. The body is capped at `LINK_ICON_MAX_BYTES` (default 16384). `Content-Type` comes from the bytes only: PNG, ICO, GIF, JPEG or WebP. Every miss is an empty `404`, so an `<img>` fires `onerror`. `HEAD` runs the same handler with no body. Rate-limited by its own bucket.',
      tags: ['Link metadata'],
      security: [{}],
      // The zod `.refine()` origin rules have no JSON Schema equivalent, so they are stated here.
      parameters: toParameters(iconQuerySchema, 'query', {
        origin:
          'Required. A bare http(s) origin, as `new URL(href).origin` gives it: no path, no trailing slash, no explicit port, a lowercase punycode host. At most 300 characters.'
      }),
      responses: {
        '200': {
          description: 'The icon bytes.',
          content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
          headers: { 'Cache-Control': { schema: { type: 'string' } } }
        },
        '400': {
          description:
            'Not a bare origin (`INVALID_URL`) or blocked by the SSRF guard (`BLOCKED_URL`). Cached for one day.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LinkMetadataError' } }
          }
        },
        '404': {
          description:
            'No usable icon. The body is empty. A clean miss is cached for one day; a timeout, network error, upstream 5xx, 408 or 429 for ten minutes.',
          headers: { 'Cache-Control': { schema: { type: 'string' } } }
        },
        '429': rateLimitedRef
      }
    }
  }
}
