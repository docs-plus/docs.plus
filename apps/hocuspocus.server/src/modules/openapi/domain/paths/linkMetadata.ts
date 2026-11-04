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
        "Runs a cache → oEmbed → special → HTML-scrape pipeline with SSRF protection. Honors `Accept-Language`. Each `200` answer sets `Cache-Control` (positive for hits, short negative for fallbacks) and `Vary: Accept-Language`. Errors use this module's own top-level `code` / `message` shape, not the house envelope. A fallback card may carry `miss`, the reason it has no preview. A docs.plus pad link's cached cards are never read again once the pad turns Private, moves to Trash or is erased: its cache key carries a per-pad generation, and that change sets a new one. A page that redirects into a pad is not cached.",
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
  '/api/metadata/image': {
    get: {
      operationId: 'getLinkImage',
      summary: 'Fetch a page image',
      description:
        'Takes a page URL and relays its page image (PNG, ICO, GIF, JPEG or WebP, up to 2 MiB) through the SSRF guard. It runs the `/api/metadata` pipeline for the page, usually a cache hit. Then it fetches the page image that result names (`image.url`): an `og:image`, or an oEmbed or site thumbnail. The 5 s timer covers only that image fetch; on a cache miss the pipeline runs first. `Content-Type` comes from the bytes only, and SVG never passes. A miss is an empty `204`. The `200` and `204` answers set `Vary: Accept-Language`. Shares the `/api/metadata` rate-limit bucket.',
      tags: ['Link metadata'],
      security: [{}],
      parameters: toParameters(metadataQuerySchema, 'query', {
        url: 'Required. The page URL. Must use the http(s) scheme and be at most 2048 characters.'
      }),
      responses: {
        '200': {
          description: 'The image bytes. Cached for one day.',
          content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
          headers: {
            'Cache-Control': { schema: { type: 'string' } },
            Vary: { schema: { type: 'string' } }
          }
        },
        '400': {
          description: 'Malformed URL (`INVALID_URL`).',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LinkMetadataError' } }
          }
        },
        '204': {
          description:
            'No usable image: a fallback page, no page image, the SSRF guard, a timeout, a non-2xx answer, bytes that are not an allowed image, or a body over the cap. Cached for ten minutes.',
          headers: {
            'Cache-Control': { schema: { type: 'string' } },
            Vary: { schema: { type: 'string' } }
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
        'Fetches `<origin>/favicon.ico` through the SSRF guard, with a 3 s budget. When it misses, reads the head of `<origin>/` and fetches one `rel=icon` or `apple-touch-icon` href through the same guard, skipping SVG and `data:`. The body is capped at `LINK_ICON_MAX_BYTES` (default 32768). `Content-Type` comes from the bytes only: PNG, ICO, GIF, JPEG or WebP. Every miss is an empty `204`, so an `<img>` fires `onerror` and Chrome logs no `404`. `HEAD` runs the same handler with no body. Rate-limited by its own bucket.',
      tags: ['Link metadata'],
      security: [{}],
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
          },
          headers: { 'Cache-Control': { schema: { type: 'string' } } }
        },
        '204': {
          description:
            'No usable icon. The body is empty. A clean miss is cached for one day. These misses are cached for ten minutes: a timeout, a network or DNS error, the SSRF guard on any hop, too many redirects, or upstream 5xx, 408 or 429.',
          headers: { 'Cache-Control': { schema: { type: 'string' } } }
        },
        '429': rateLimitedRef
      }
    }
  }
}
