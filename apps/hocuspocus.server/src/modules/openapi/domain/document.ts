import type { OpenApiDocument, OpenApiServer } from '../types'
import { components } from './components'
import { adminPaths } from './paths/admin'
import { documentChangesPaths } from './paths/documentChanges'
import { documentContentPaths } from './paths/documentContent'
import { documentConversionPaths } from './paths/documentConversion'
import { documentsPaths } from './paths/documents'
import { documentVersionsPaths } from './paths/documentVersions'
import { emailPaths } from './paths/email'
import { healthPaths } from './paths/health'
import { linkMetadataPaths } from './paths/linkMetadata'
import { mediaPaths } from './paths/media'
import { servicePaths } from './paths/service'

export interface BuildDeps {
  servers: OpenApiServer[]
  version: string
}

const DESCRIPTION = `REST surface of \`@docs.plus/hocuspocus\`. The collaboration WebSocket protocol is not described here — see API.md §WebSocket API.

**Error envelope.** The canonical shape is \`ErrorEnvelope\`; \`error.details\` appears only when \`NODE_ENV=development\`. Several handlers still return ad-hoc shapes: \`LegacyError\` (email handlers, admin middleware, media-upload guards) and \`LinkMetadataError\` (top-level \`code\`/\`message\`). Wiring \`getErrorResponse\` everywhere is a separate task; the variants are documented as-is rather than smoothed over.

**Rate limiting.** A global limiter covers every non-\`OPTIONS\` request except \`/health\` and \`/health/*\`: \`RATE_LIMIT_MAX\` requests (default 100) per 15-minute window, keyed on client IP, backed by Redis. When Redis is unavailable the limiter is disabled and requests pass. Requests with neither \`x-forwarded-for\` nor \`x-real-ip\` skip it. Every response carries \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\`.

**Push notifications** have no HTTP endpoint beyond \`GET /health/push\`. Delivery runs through pgmq and devices register through the \`register_push_subscription\` / \`unregister_push_subscription\` Supabase RPCs.

**Not described here:** \`POST /internal/documents/{documentId}/content\`, \`POST /internal/documents/{documentId}/versions\` and \`POST /internal/documents/{documentId}/versions/{version}/restore\` live on the collaboration process's internal listener (\`HOCUSPOCUS_INTERNAL_HTTP_PORT\`, default 4003), not on this server, and are not reachable at any \`servers\` URL.`

const TAGS = [
  { name: 'Service', description: 'Liveness, metrics and this documentation.' },
  {
    name: 'Health',
    description: 'Dependency probes. The only routes exempt from the rate limiter.'
  },
  { name: 'Documents', description: 'Document metadata, search, lifecycle and Trash.' },
  {
    name: 'Document content',
    description:
      'Read and write a document body, and convert it to or from a file. The content routes are service-role only; export and import also take a user token. Writes reach live collaborators in real time.'
  },
  {
    name: 'Document versions',
    description:
      "Read, compare, name, delete and restore a document's history. Service-role only. Every debounced save is already a version — there is no schedule to configure."
  },
  {
    name: 'Document changes',
    description:
      'What changed in a document between two points in time, per heading section. Read-only and service-role only. Feeds the digest email.'
  },
  {
    name: 'Media',
    description: "Uploads and streaming for the editor's hypermultimedia extension."
  },
  { name: 'Link metadata', description: 'URL unfurling with SSRF protection.' },
  {
    name: 'Email',
    description: 'Internal triggers and webhooks. Normal delivery runs through pgmq, not HTTP.'
  },
  { name: 'Admin', description: 'Requires a Supabase JWT whose subject has an `admin_users` row.' },
  {
    name: 'Push',
    description:
      'No HTTP endpoint — registration is a Supabase RPC. Only the health probe is listed.'
  }
]

export const buildOpenApiDocument = (deps: BuildDeps): OpenApiDocument => ({
  openapi: '3.1.1',
  info: {
    title: 'docs.plus Backend API',
    version: deps.version,
    description: DESCRIPTION
  },
  servers: deps.servers,
  tags: TAGS,
  paths: {
    ...servicePaths,
    ...healthPaths,
    ...documentsPaths,
    ...documentContentPaths,
    ...documentVersionsPaths,
    ...documentChangesPaths,
    ...documentConversionPaths,
    ...mediaPaths,
    ...linkMetadataPaths,
    ...emailPaths,
    ...adminPaths
  },
  components
})
