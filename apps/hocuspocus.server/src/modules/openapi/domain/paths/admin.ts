import type { z } from 'zod'

import {
  auditEmailBouncesQuerySchema,
  auditFailedSubsQuerySchema,
  batchTrendsQuerySchema,
  bulkDeleteSchema,
  daysQuerySchema,
  deleteDocumentSchema,
  digestSettingsBodySchema,
  disableFailedSubsSchema,
  ghostAccountsQuerySchema,
  ghostBulkDeleteSchema,
  ghostCleanupAnonymousSchema,
  ghostDeleteSchema,
  ghostResendSchema,
  listDocumentsQuerySchema,
  mcpUsageQuerySchema,
  mediaStorageQuerySchema,
  paginationQuerySchema,
  staleDocumentsQuerySchema,
  trendQuerySchema,
  updateDocumentSchema
} from '../../../../schemas/admin.schema'
import type {
  HttpMethod,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiPaths,
  OpenApiResponse
} from '../../types'
import {
  envelopeOrLegacyResponse,
  envelopeResponse,
  legacyResponse,
  rateLimitedRef
} from '../components'
import { pathParam, toJsonSchema, toParameters } from '../jsonSchema'

interface AdminRoute {
  path: string
  method: HttpMethod
  id: string
  summary: string
  group: string
  description?: string
  query?: z.ZodType
  body?: z.ZodType
  /** Path params the router checks with zValidator. Use `params` for unchecked ones. */
  pathSchema?: z.ZodType
  params?: OpenApiParameter[]
  /** Responses that differ from the shared map in `toOperation`. */
  extraResponses?: Record<string, OpenApiResponse>
}

const idParam = pathParam('id', 'Target row id.')
const slugParam = pathParam('slug', 'Document slug.')

/** The Email setup router has no onError, so a throw reaches the app-wide envelope handler. */
const setupInternalError = envelopeOrLegacyResponse(
  'Unhandled error (`ErrorEnvelope`), or the admin guard failed (`LegacyError`).'
)

const routes: AdminRoute[] = [
  {
    path: '/stats',
    method: 'get',
    id: 'adminGetDashboardStats',
    summary: 'Dashboard overview stats',
    group: 'Dashboard & users'
  },
  {
    path: '/stats/platform',
    method: 'get',
    id: 'adminGetPlatformStats',
    summary: 'Platform stats and directory',
    group: 'Dashboard & users'
  },
  {
    path: '/stats/notifications',
    method: 'get',
    id: 'adminGetNotificationStats',
    summary: 'Notification stats',
    group: 'Dashboard & users'
  },
  {
    path: '/stats/email',
    method: 'get',
    id: 'adminGetEmailStats',
    summary: 'Email stats',
    group: 'Dashboard & users'
  },
  {
    path: '/email/digest-grouping',
    method: 'get',
    id: 'adminGetDigestGrouping',
    summary: 'Digest grouping and size cap',
    group: 'Email digest'
  },
  {
    path: '/email/digest-grouping',
    method: 'put',
    id: 'adminSetDigestGrouping',
    summary: 'Set digest grouping or size cap',
    group: 'Email digest',
    description: 'Send `grouping`, `maxKb` or both. Stored in Redis, so `503` without Redis.',
    body: digestSettingsBodySchema
  },
  {
    path: '/mcp/usage',
    method: 'get',
    id: 'adminGetMcpUsage',
    summary: 'MCP connector usage',
    group: 'MCP connector usage',
    description:
      'Calls and distinct callers per UTC day, plus tool and app totals for the window. House envelope.',
    query: mcpUsageQuerySchema,
    extraResponses: {
      '500': envelopeOrLegacyResponse(
        'The usage read failed (`ErrorEnvelope`, code `MCP_USAGE_FAILED`), or the admin guard failed (`LegacyError`).'
      )
    }
  },
  {
    path: '/stats/push',
    method: 'get',
    id: 'adminGetPushStats',
    summary: 'Push stats',
    group: 'Dashboard & users'
  },
  {
    path: '/stats/push/pipeline',
    method: 'get',
    id: 'adminGetPushPipeline',
    summary: 'Push pipeline stats',
    group: 'Dashboard & users'
  },
  {
    path: '/push/subscriptions',
    method: 'get',
    id: 'adminGetPushSubscriptions',
    summary: 'Raw push subscriptions',
    group: 'Dashboard & users'
  },
  {
    path: '/push/gateway',
    method: 'get',
    id: 'adminGetPushGateway',
    summary: 'Push gateway status',
    group: 'Dashboard & users',
    description:
      'VAPID and queue flags with queue counts. Always 200 with the status, even when push is not configured.'
  },
  {
    path: '/system/table-sizes',
    method: 'get',
    id: 'adminGetTableSizes',
    summary: 'Database table sizes',
    group: 'Dashboard & users'
  },
  {
    path: '/users',
    method: 'get',
    id: 'adminListUsers',
    summary: 'List users',
    group: 'Dashboard & users'
  },
  {
    path: '/users/notification-subs',
    method: 'get',
    id: 'adminGetUserNotificationSubs',
    summary: 'Per-user notification subscriptions',
    group: 'Dashboard & users'
  },
  {
    path: '/users/document-counts',
    method: 'get',
    id: 'adminGetUserDocumentCounts',
    summary: 'Document count per user',
    group: 'Dashboard & users'
  },
  {
    path: '/users/admins',
    method: 'get',
    id: 'adminGetAdminUserIds',
    summary: 'All admin user ids',
    group: 'Dashboard & users'
  },
  {
    path: '/users/{id}/toggle-admin',
    method: 'post',
    id: 'adminToggleAdminRole',
    summary: 'Grant or revoke admin',
    group: 'Dashboard & users',
    description:
      'Refuses your own id and the last admin with `403`. A revoke is one locked `admin_revoke_admin` call, so two revokes at once cannot leave zero admins.',
    params: [idParam]
  },
  {
    path: '/channels',
    method: 'get',
    id: 'adminListChannels',
    summary: 'List chat channels',
    group: 'Dashboard & users'
  },

  {
    path: '/documents',
    method: 'get',
    id: 'adminListDocuments',
    summary: 'List documents',
    group: 'Documents',
    query: listDocumentsQuerySchema
  },
  {
    path: '/documents/stats',
    method: 'get',
    id: 'adminGetDocumentStats',
    summary: 'Document statistics',
    group: 'Documents'
  },
  {
    path: '/documents/{id}',
    method: 'patch',
    id: 'adminUpdateDocument',
    summary: 'Update document flags',
    group: 'Documents',
    params: [idParam],
    body: updateDocumentSchema
  },
  {
    path: '/documents/{id}',
    method: 'delete',
    id: 'adminDeleteDocument',
    summary: 'Delete a document',
    description: 'Requires `confirmSlug` in the body.',
    group: 'Documents',
    params: [idParam],
    body: deleteDocumentSchema
  },
  {
    path: '/documents/{id}/deletion-impact',
    method: 'get',
    id: 'adminGetDocumentDeletionImpact',
    summary: 'Preview the deletion cascade',
    group: 'Documents',
    params: [idParam]
  },
  {
    path: '/documents/{slug}/views',
    method: 'get',
    id: 'adminGetDocumentViewStats',
    summary: 'View stats for one document',
    group: 'Documents',
    params: [slugParam]
  },
  {
    path: '/documents/{slug}/preview',
    method: 'get',
    id: 'adminGetDocumentPreview',
    summary: 'Content preview',
    group: 'Documents',
    params: [slugParam]
  },

  {
    path: '/stats/views',
    method: 'get',
    id: 'adminGetViewsSummary',
    summary: 'Overall view summary',
    group: 'View analytics'
  },
  {
    path: '/stats/views/top',
    method: 'get',
    id: 'adminGetTopViewedDocuments',
    summary: 'Top viewed documents',
    group: 'View analytics',
    query: paginationQuerySchema
  },
  {
    path: '/stats/views/trend',
    method: 'get',
    id: 'adminGetViewsTrend',
    summary: 'View trend series',
    group: 'View analytics',
    query: trendQuerySchema
  },
  {
    path: '/stats/views/batch-trends',
    method: 'get',
    id: 'adminGetBatchDocumentTrends',
    summary: 'Per-document sparkline trends',
    group: 'View analytics',
    query: batchTrendsQuerySchema
  },

  {
    path: '/stats/retention',
    method: 'get',
    id: 'adminGetRetentionMetrics',
    summary: 'DAU/WAU/MAU',
    group: 'Retention & activity'
  },
  {
    path: '/stats/user-lifecycle',
    method: 'get',
    id: 'adminGetUserLifecycleSegments',
    summary: 'Lifecycle segments',
    group: 'Retention & activity'
  },
  {
    path: '/stats/dau-trend',
    method: 'get',
    id: 'adminGetDauTrend',
    summary: 'Daily active users trend',
    group: 'Retention & activity',
    query: daysQuerySchema
  },
  {
    path: '/stats/signups-trend',
    method: 'get',
    id: 'adminGetSignupsTrend',
    summary: 'Signups trend',
    group: 'Retention & activity',
    query: daysQuerySchema
  },
  {
    path: '/stats/activity-heatmap',
    method: 'get',
    id: 'adminGetActivityByHour',
    summary: 'Activity by hour',
    group: 'Retention & activity',
    query: daysQuerySchema
  },
  {
    path: '/stats/top-active-documents',
    method: 'get',
    id: 'adminGetTopActiveDocuments',
    summary: 'Most active documents by message count',
    group: 'Retention & activity',
    query: paginationQuerySchema
  },
  {
    path: '/stats/communication',
    method: 'get',
    id: 'adminGetCommunicationStats',
    summary: 'Communication stats',
    group: 'Retention & activity',
    query: daysQuerySchema
  },
  {
    path: '/stats/message-types',
    method: 'get',
    id: 'adminGetMessageTypeDistribution',
    summary: 'Message type distribution',
    group: 'Retention & activity',
    query: daysQuerySchema
  },
  {
    path: '/stats/notification-reach',
    method: 'get',
    id: 'adminGetNotificationReach',
    summary: 'Notification delivery stats',
    group: 'Retention & activity'
  },

  {
    path: '/documents/stale/summary',
    method: 'get',
    id: 'adminGetStaleDocumentsSummary',
    summary: 'Stale documents summary',
    group: 'Stale documents audit'
  },
  {
    path: '/documents/stale',
    method: 'get',
    id: 'adminListStaleDocuments',
    summary: 'List stale documents',
    group: 'Stale documents audit',
    query: staleDocumentsQuerySchema
  },
  {
    path: '/documents/stale/bulk-delete',
    method: 'post',
    id: 'adminBulkDeleteStaleDocuments',
    summary: 'Bulk delete stale documents',
    group: 'Stale documents audit',
    body: bulkDeleteSchema
  },

  {
    path: '/audit/media-storage/summary',
    method: 'get',
    id: 'adminGetMediaStorageSummary',
    summary: 'Media storage rollup',
    group: 'Media storage audit'
  },
  {
    path: '/audit/media-storage',
    method: 'get',
    id: 'adminListMediaStorage',
    summary: 'Per-workspace media storage',
    description: '`scope=all` exports the filtered fleet, capped at 10 000 rows.',
    group: 'Media storage audit',
    query: mediaStorageQuerySchema
  },

  {
    path: '/audit/notifications/health',
    method: 'get',
    id: 'adminGetNotificationHealth',
    summary: 'Combined notification health score',
    group: 'Notification audit'
  },
  {
    path: '/audit/notifications/push-failures',
    method: 'get',
    id: 'adminGetPushFailureSummary',
    summary: 'Push failure breakdown',
    group: 'Notification audit'
  },
  {
    path: '/audit/notifications/email-failures',
    method: 'get',
    id: 'adminGetEmailFailureSummary',
    summary: 'Email failure and bounce breakdown',
    group: 'Notification audit'
  },
  {
    path: '/audit/notifications/failed-subscriptions',
    method: 'get',
    id: 'adminGetFailedPushSubscriptions',
    summary: 'Failed push subscriptions',
    group: 'Notification audit',
    query: auditFailedSubsQuerySchema
  },
  {
    path: '/audit/notifications/email-bounces',
    method: 'get',
    id: 'adminGetEmailBounces',
    summary: 'Bounce list',
    group: 'Notification audit',
    query: auditEmailBouncesQuerySchema
  },
  {
    path: '/audit/notifications/disable-failed',
    method: 'post',
    id: 'adminDisableFailedSubscriptions',
    summary: 'Disable dead subscriptions',
    group: 'Notification audit',
    body: disableFailedSubsSchema
  },
  {
    path: '/audit/notifications/dlq',
    method: 'get',
    id: 'adminGetDeadLetterQueue',
    summary: 'BullMQ dead-letter contents',
    group: 'Notification audit',
    description:
      'One summary per job: type, failure kind and code, masked `to` and the reason. Never the job data.'
  },
  {
    path: '/email/setup',
    method: 'get',
    id: 'adminGetEmailSetup',
    summary: 'Email setup status',
    group: 'Email setup',
    description:
      'Provider, config status, set or missing per secret, a live connection check, the newest bounce (masked) and the email DLQ depth. Never returns a secret value. House envelope.',
    extraResponses: { '500': setupInternalError }
  },
  {
    path: '/email/setup/test-send',
    method: 'post',
    id: 'adminSendTestEmail',
    summary: 'Send a test email to yourself',
    group: 'Email setup',
    description:
      "No body. Sends to the signed-in admin's own address. Answers `{ sent: true, messageId, to }`, with `to` masked, or `{ sent: false, kind, code }`.",
    extraResponses: {
      '400': envelopeResponse('Code `NO_EMAIL`: the admin account has no email address.'),
      '429': envelopeResponse(
        'Code `RATE_LIMITED`: one test email per admin per minute. The global limiter answers `RATE_LIMIT_EXCEEDED`.'
      ),
      '500': setupInternalError,
      '503': envelopeOrLegacyResponse(
        'Redis is not available (`ErrorEnvelope`, code `SERVICE_UNAVAILABLE`), or the admin guard cannot reach Supabase auth (`LegacyError`).'
      )
    }
  },

  {
    path: '/audit/ghost-accounts',
    method: 'get',
    id: 'adminGetGhostAccounts',
    summary: 'List ghost accounts',
    group: 'Ghost accounts audit',
    query: ghostAccountsQuerySchema
  },
  {
    path: '/audit/ghost-accounts/summary',
    method: 'get',
    id: 'adminGetGhostAccountsSummary',
    summary: 'Ghost category summary',
    group: 'Ghost accounts audit'
  },
  {
    path: '/audit/ghost-accounts/{id}/impact',
    method: 'get',
    id: 'adminGetGhostDeletionImpact',
    summary: 'FK dependency check',
    group: 'Ghost accounts audit',
    params: [idParam]
  },
  {
    path: '/audit/ghost-accounts/{id}',
    method: 'delete',
    id: 'adminDeleteGhostAccount',
    summary: 'Smart-delete one ghost account',
    group: 'Ghost accounts audit',
    description:
      'Reads the account again first, because the list is cached. A user with blocking messages or owned documents outside Trash is soft-deleted: banned, with the public profile cleared. Others are hard-deleted.',
    pathSchema: ghostDeleteSchema,
    extraResponses: {
      '409': legacyResponse(
        '`{ error }` names the refusal: `User not found`, `User is no longer a ghost account` or `User is an admin`. An unknown id is a 409, not a 404.'
      )
    }
  },
  {
    path: '/audit/ghost-accounts/bulk-delete',
    method: 'post',
    id: 'adminBulkDeleteGhostAccounts',
    summary: 'Bulk delete ghost accounts',
    group: 'Ghost accounts audit',
    body: ghostBulkDeleteSchema
  },
  {
    path: '/audit/ghost-accounts/resend-confirmation',
    method: 'post',
    id: 'adminResendGhostConfirmation',
    summary: 'Resend magic link',
    group: 'Ghost accounts audit',
    body: ghostResendSchema
  },
  {
    path: '/audit/ghost-accounts/cleanup-anonymous',
    method: 'post',
    id: 'adminCleanupAnonymousSessions',
    summary: 'Clean stale anonymous sessions',
    group: 'Ghost accounts audit',
    body: ghostCleanupAnonymousSchema
  }
]

const toOperation = (route: AdminRoute): OpenApiOperation => {
  const parameters = [
    ...(route.params ?? []),
    ...(route.pathSchema ? toParameters(route.pathSchema, 'path') : []),
    ...(route.query ? toParameters(route.query, 'query') : [])
  ]
  const hasValidator = Boolean(route.query || route.body || route.pathSchema)

  return {
    operationId: route.id,
    summary: route.summary,
    description: [route.group, route.description].filter(Boolean).join(' — '),
    tags: ['Admin'],
    security: [{ adminBearer: [] }],
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(route.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: toJsonSchema(route.body) } }
          }
        }
      : {}),
    responses: {
      '200': {
        description: 'Endpoint-specific payload.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminPayload' } } }
      },
      // zValidator is registered after adminAuthMiddleware, so a 400 here still
      // means the caller passed the admin gate.
      ...(hasValidator ? { '400': { $ref: '#/components/responses/ValidationError' } } : {}),
      '401': { $ref: '#/components/responses/LegacyUnauthorized' },
      '403': { $ref: '#/components/responses/LegacyForbidden' },
      '429': rateLimitedRef,
      '500': { $ref: '#/components/responses/LegacyInternalError' },
      '503': { $ref: '#/components/responses/LegacyInternalError' },
      ...route.extraResponses
    }
  }
}

export const adminPaths: OpenApiPaths = routes.reduce<OpenApiPaths>((paths, route) => {
  const fullPath = `/api/admin${route.path}`
  const item = paths[fullPath] ?? {}
  item[route.method] = toOperation(route)
  paths[fullPath] = item
  return paths
}, {})
