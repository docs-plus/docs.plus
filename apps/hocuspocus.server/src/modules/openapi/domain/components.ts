import { tiptapDocSchema } from '../../document-content/http/schema'
import type { JsonSchema, OpenApiComponents, OpenApiResponse } from '../types'
import { toJsonSchema } from './jsonSchema'

/**
 * Three schemes, and two of them ride the same `Authorization: Bearer`
 * header. OpenAPI cannot express "same header, different credential", so they
 * are named apart and the descriptions carry the distinction.
 */
const securitySchemes: OpenApiComponents['securitySchemes'] = {
  supabaseUserToken: {
    type: 'apiKey',
    in: 'header',
    name: 'token',
    description:
      'Supabase user access token. `Authorization: Bearer <jwt>` is accepted on the same routes — `extractToken` (src/api/middleware/auth.ts) reads either header.'
  },
  serviceRoleKey: {
    type: 'http',
    scheme: 'bearer',
    description:
      '`SUPABASE_SERVICE_ROLE_KEY` sent as `Authorization: Bearer <key>`. Constant-time compare that fails closed in every environment when the key is unset.'
  },
  adminBearer: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Supabase user JWT whose subject has a row in `admin_users`. 401 when the token is missing or invalid, 403 when the row is absent.'
  }
}

const errorEnvelope: JsonSchema = {
  type: 'object',
  description: 'Canonical error shape from `getErrorResponse` (src/lib/errors.ts).',
  properties: {
    success: { type: 'boolean', const: false },
    error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: {
          type: 'string',
          examples: ['VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT']
        },
        details: { description: 'Present only when `NODE_ENV=development`.' }
      },
      required: ['message', 'code']
    }
  },
  required: ['success', 'error']
}

/** Verified against `@hono/zod-validator`'s default hook: a serialized ZodError, no `code`. */
const zodValidationError: JsonSchema = {
  type: 'object',
  description:
    'Raw `@hono/zod-validator` rejection. Routes without a custom hook return this instead of `ErrorEnvelope` — `error` is a serialized `ZodError`, so there is no `error.code`.',
  properties: {
    success: { type: 'boolean', const: false },
    error: {
      type: 'object',
      properties: {
        name: { type: 'string', const: 'ZodError' },
        message: { type: 'string', description: 'JSON-encoded array of zod issues.' }
      },
      required: ['name', 'message']
    }
  },
  required: ['success', 'error']
}

const legacyError: JsonSchema = {
  type: 'object',
  description:
    'Ad-hoc shape used by the email handlers, admin middleware and media-upload guards. Wiring these onto `ErrorEnvelope` is a separate task.',
  properties: { error: { type: 'string' } },
  required: ['error']
}

const linkMetadataError: JsonSchema = {
  type: 'object',
  description: 'Link-metadata puts `code` and `message` at the top level, not inside `error`.',
  properties: {
    success: { type: 'boolean', const: false },
    code: { type: 'string', enum: ['INVALID_URL', 'BLOCKED_URL'] },
    message: { type: 'string' }
  },
  required: ['success', 'code', 'message']
}

// The house envelope with the code pinned. The retry seconds are the `Retry-After`
// header only — the limiter never carried them in the body's canonical shape.
const rateLimitError: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', const: false },
    error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'string', const: 'RATE_LIMIT_EXCEEDED' }
      },
      required: ['message', 'code']
    }
  },
  required: ['success', 'error']
}

const healthCheckResult: JsonSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['healthy', 'unhealthy', 'disabled'] },
    lastCheck: { type: 'string', format: 'date-time' },
    error: { type: 'string' },
    metadata: { type: 'object', additionalProperties: true }
  },
  required: ['status', 'lastCheck']
}

const overallHealth: JsonSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    timestamp: { type: 'string', format: 'date-time' },
    services: {
      type: 'object',
      properties: {
        database: { $ref: '#/components/schemas/HealthCheckResult' },
        redis: { $ref: '#/components/schemas/HealthCheckResult' },
        supabase: { $ref: '#/components/schemas/HealthCheckResult' }
      },
      required: ['database', 'redis', 'supabase']
    }
  },
  required: ['status', 'timestamp', 'services']
}

const pushHealth: JsonSchema = {
  type: 'object',
  description: 'Push gateway status. 200 when VAPID is configured and the queue is connected.',
  properties: {
    vapid_configured: { type: 'boolean' },
    queue_connected: { type: 'boolean' }
  },
  additionalProperties: true
}

/** Row shape is a Prisma projection plus a joined owner profile — not modelled field-by-field. */
const documentSummary: JsonSchema = {
  type: 'object',
  description:
    'Document metadata row. Includes at least `documentId`, `slug`, `title`, `description`, `keywords`, `readOnly`, `isPrivate`, `createdAt`, `updatedAt`, plus the joined snake_case owner profile.',
  additionalProperties: true
}

const documentListPage: JsonSchema = {
  type: 'object',
  properties: {
    docs: { type: 'array', items: { $ref: '#/components/schemas/DocumentSummary' } },
    total: {
      type: 'integer',
      description: 'Matching rows. Private rows are clamped out for unverified callers.'
    }
  },
  required: ['docs', 'total']
}

const contentRead: JsonSchema = {
  type: 'object',
  properties: {
    documentId: { type: 'string' },
    version: { type: 'integer', description: '`0` when metadata exists but no snapshot does.' },
    format: { type: 'string', enum: ['json', 'text'] },
    content: {
      description: 'A Tiptap document for `format=json`; one line per textblock for `format=text`.',
      oneOf: [{ $ref: '#/components/schemas/TiptapDoc' }, { type: 'string' }]
    }
  },
  required: ['documentId', 'version', 'format', 'content']
}

/** Mirrors the `MetadataResponse` wire contract in link-metadata/domain/types.ts. */
const linkMetadata: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', const: true },
    url: { type: 'string', format: 'uri' },
    requested_url: { type: 'string', format: 'uri' },
    title: { type: 'string' },
    description: { type: 'string' },
    lang: { type: 'string' },
    media_type: {
      type: 'string',
      enum: ['website', 'article', 'video', 'audio', 'image', 'profile', 'document']
    },
    author: {
      type: 'object',
      properties: { name: { type: 'string' }, url: { type: 'string' }, avatar: { type: 'string' } }
    },
    publisher: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        url: { type: 'string' },
        logo: { type: 'string' },
        theme_color: { type: 'string' }
      }
    },
    image: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        width: { type: 'integer' },
        height: { type: 'integer' },
        alt: { type: 'string' }
      },
      required: ['url']
    },
    icon: { type: 'string' },
    favicon: { type: 'string' },
    oembed: {
      type: 'object',
      description: 'The provider `html` field is deliberately withheld — it is a stored-XSS sink.',
      properties: {
        type: { type: 'string', enum: ['video', 'rich', 'photo', 'link'] },
        provider: { type: 'string' },
        width: { type: 'integer' },
        height: { type: 'integer' },
        thumbnail: { type: 'string' }
      },
      required: ['type', 'provider']
    },
    published_at: { type: 'string' },
    modified_at: { type: 'string' },
    cached: { type: 'boolean' },
    fetched_at: { type: 'string', format: 'date-time' }
  },
  required: ['success', 'url', 'requested_url', 'title', 'cached', 'fetched_at']
}

/** Endpoint-specific admin payloads are not modelled; inventing fields would be a lie. */
const adminPayload: JsonSchema = {
  type: 'object',
  description: 'Endpoint-specific payload. See the matching handler in src/api/controllers/.',
  additionalProperties: true
}

const jsonResponse = (description: string, ref: string): OpenApiResponse => ({
  description,
  content: { 'application/json': { schema: { $ref: ref } } }
})

const envelopeResponse = (description: string): OpenApiResponse =>
  jsonResponse(description, '#/components/schemas/ErrorEnvelope')

const legacyResponse = (description: string): OpenApiResponse =>
  jsonResponse(description, '#/components/schemas/LegacyError')

const rateLimited: OpenApiResponse = {
  description:
    'Global limiter tripped: `RATE_LIMIT_MAX` requests (default 100) per 15-minute window, keyed on client IP.',
  headers: {
    'Retry-After': { description: 'Seconds until retry.', schema: { type: 'integer' } },
    'X-RateLimit-Limit': { schema: { type: 'integer' } },
    'X-RateLimit-Remaining': { schema: { type: 'integer' } },
    'X-RateLimit-Reset': { schema: { type: 'string', format: 'date-time' } }
  },
  content: { 'application/json': { schema: { $ref: '#/components/schemas/RateLimitError' } } }
}

export const components: OpenApiComponents = {
  securitySchemes,
  schemas: {
    ErrorEnvelope: errorEnvelope,
    ZodValidationError: zodValidationError,
    LegacyError: legacyError,
    LinkMetadataError: linkMetadataError,
    RateLimitError: rateLimitError,
    HealthCheckResult: healthCheckResult,
    OverallHealth: overallHealth,
    PushHealth: pushHealth,
    DocumentSummary: documentSummary,
    DocumentListPage: documentListPage,
    TiptapDoc: toJsonSchema(tiptapDocSchema),
    ContentRead: contentRead,
    LinkMetadata: linkMetadata,
    AdminPayload: adminPayload
  },
  responses: {
    ValidationError: envelopeResponse(
      'Rejected by a handler or service guard (an `AppError`), so it carries the house envelope.'
    ),
    ZodValidationError: jsonResponse(
      'Rejected by `zValidator` before the handler ran — on the email routes, before the service-role check too. Not the house envelope. Where the handler or service can also reject with an `AppError`, that 400 arrives as `ErrorEnvelope` instead, so treat a 400 body as either shape.',
      '#/components/schemas/ZodValidationError'
    ),
    Unauthorized: envelopeResponse('Missing, invalid or expired credentials.'),
    Forbidden: envelopeResponse('Authenticated but not permitted.'),
    NotFound: envelopeResponse('No such resource, or it is soft-deleted.'),
    Conflict: envelopeResponse('Slug already taken.'),
    PayloadTooLarge: envelopeResponse('Body exceeds the 5 MiB content cap.'),
    UnprocessableEntity: envelopeResponse(
      'Content rejected by the encoder: unknown node or mark, content-expression violation, missing level-1 title heading, or over 50 000 nodes / 100 levels of nesting. Nothing is written.'
    ),
    InternalError: envelopeResponse('Unhandled server error.'),
    ServiceUnavailable: envelopeResponse(
      'A dependency is unreachable — Supabase auth, or the collaboration process on content writes.'
    ),
    LegacyUnauthorized: legacyResponse('Missing or invalid credentials (ad-hoc error shape).'),
    LegacyForbidden: legacyResponse('Admin access required (ad-hoc error shape).'),
    LegacyInternalError: legacyResponse('Server error (ad-hoc error shape).'),
    RateLimited: rateLimited
  }
}

/** Every non-health route passes the global limiter, so every one of them can 429. */
export const rateLimitedRef = { $ref: '#/components/responses/RateLimited' } as const
