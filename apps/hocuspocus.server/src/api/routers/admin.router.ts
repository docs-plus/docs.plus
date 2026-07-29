import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import {
  auditEmailBouncesQuerySchema,
  auditFailedSubsQuerySchema,
  batchTrendsQuerySchema,
  bulkDeleteSchema,
  daysQuerySchema,
  deleteDocumentSchema,
  disableFailedSubsSchema,
  ghostAccountsQuerySchema,
  ghostBulkDeleteSchema,
  ghostCleanupAnonymousSchema,
  ghostResendSchema,
  listDocumentsQuerySchema,
  mediaStorageQuerySchema,
  paginationQuerySchema,
  staleDocumentsQuerySchema,
  trendQuerySchema,
  updateDocumentSchema
} from '../../schemas/admin.schema'
import * as adminController from '../controllers/admin.controller'
import { adminAuthMiddleware } from '../middleware/adminAuth'

const admin = new Hono()

admin.use('*', adminAuthMiddleware)

admin.get('/stats', adminController.getDashboardStats)

// Platform stats + directory (service_role; system-wide, RLS-bypassing)
admin.get('/stats/platform', adminController.getPlatformStats)
admin.get('/stats/notifications', adminController.getNotificationStatsAdmin)
admin.get('/stats/email', adminController.getEmailStatsAdmin)
admin.get('/stats/push', adminController.getPushStatsAdmin)
admin.get('/stats/push/pipeline', adminController.getPushPipelineAdmin)
admin.get('/push/subscriptions', adminController.getPushSubscriptionsRaw)
admin.get('/system/table-sizes', adminController.getTableSizes)
admin.get('/users', adminController.listUsers)
admin.get('/users/notification-subs', adminController.getUserNotificationSubs)
admin.get('/channels', adminController.listChannels)

admin.get('/users/document-counts', adminController.getUserDocumentCounts)

admin.get('/users/admins', adminController.getAdminUserIds)

admin.post('/users/:id/toggle-admin', adminController.toggleAdminRole)

admin.get('/documents/stats', adminController.getDocumentStats)

admin.get(
  '/documents',
  zValidator('query', listDocumentsQuerySchema),
  adminController.listDocuments
)

admin.patch(
  '/documents/:id',
  zValidator('json', updateDocumentSchema),
  adminController.updateDocument
)

admin.get('/documents/:id/deletion-impact', adminController.getDocumentDeletionImpact)

admin.delete(
  '/documents/:id',
  zValidator('json', deleteDocumentSchema),
  adminController.deleteDocument
)

// Document view analytics

admin.get('/stats/views', adminController.getViewsSummary)

admin.get(
  '/stats/views/top',
  zValidator('query', paginationQuerySchema),
  adminController.getTopViewedDocuments
)

admin.get(
  '/stats/views/trend',
  zValidator('query', trendQuerySchema),
  adminController.getViewsTrend
)

admin.get('/documents/:slug/views', adminController.getDocumentViewStats)

admin.get(
  '/stats/views/batch-trends',
  zValidator('query', batchTrendsQuerySchema),
  adminController.getBatchDocumentTrends
)

// User retention analytics

admin.get('/stats/retention', adminController.getRetentionMetrics)

admin.get('/stats/user-lifecycle', adminController.getUserLifecycleSegments)

admin.get('/stats/dau-trend', zValidator('query', daysQuerySchema), adminController.getDauTrend)

admin.get(
  '/stats/signups-trend',
  zValidator('query', daysQuerySchema),
  adminController.getSignupsTrend
)

admin.get(
  '/stats/activity-heatmap',
  zValidator('query', daysQuerySchema),
  adminController.getActivityByHour
)

admin.get(
  '/stats/top-active-documents',
  zValidator('query', paginationQuerySchema),
  adminController.getTopActiveDocuments
)

admin.get(
  '/stats/communication',
  zValidator('query', daysQuerySchema),
  adminController.getCommunicationStats
)

admin.get(
  '/stats/message-types',
  zValidator('query', daysQuerySchema),
  adminController.getMessageTypeDistribution
)

admin.get('/stats/notification-reach', adminController.getNotificationReach)

// Stale documents audit

admin.get('/documents/stale/summary', adminController.getStaleDocumentsSummary)

admin.get(
  '/documents/stale',
  zValidator('query', staleDocumentsQuerySchema),
  adminController.listStaleDocuments
)

admin.get('/documents/:slug/preview', adminController.getDocumentPreview)

admin.post(
  '/documents/stale/bulk-delete',
  zValidator('json', bulkDeleteSchema),
  adminController.bulkDeleteStaleDocuments
)

// Media storage audit

admin.get('/audit/media-storage/summary', adminController.getMediaStorageSummary)

admin.get(
  '/audit/media-storage',
  zValidator('query', mediaStorageQuerySchema),
  adminController.listMediaStorage
)

// Failed notifications audit

admin.get('/audit/notifications/health', adminController.getNotificationHealth)

admin.get('/audit/notifications/push-failures', adminController.getPushFailureSummary)

admin.get('/audit/notifications/email-failures', adminController.getEmailFailureSummary)

admin.get(
  '/audit/notifications/failed-subscriptions',
  zValidator('query', auditFailedSubsQuerySchema),
  adminController.getFailedPushSubscriptions
)

admin.get(
  '/audit/notifications/email-bounces',
  zValidator('query', auditEmailBouncesQuerySchema),
  adminController.getEmailBounces
)

admin.post(
  '/audit/notifications/disable-failed',
  zValidator('json', disableFailedSubsSchema),
  adminController.disableFailedSubscriptions
)

admin.get('/audit/notifications/dlq', adminController.getDeadLetterQueueContents)

// Ghost accounts audit

admin.get(
  '/audit/ghost-accounts',
  zValidator('query', ghostAccountsQuerySchema),
  adminController.getGhostAccounts
)

admin.get('/audit/ghost-accounts/summary', adminController.getGhostAccountsSummary)

admin.get('/audit/ghost-accounts/:id/impact', adminController.getGhostDeletionImpact)

admin.delete('/audit/ghost-accounts/:id', adminController.deleteGhostAccount)

admin.post(
  '/audit/ghost-accounts/bulk-delete',
  zValidator('json', ghostBulkDeleteSchema),
  adminController.bulkDeleteGhostAccounts
)

admin.post(
  '/audit/ghost-accounts/resend-confirmation',
  zValidator('json', ghostResendSchema),
  adminController.resendGhostConfirmation
)

admin.post(
  '/audit/ghost-accounts/cleanup-anonymous',
  zValidator('json', ghostCleanupAnonymousSchema),
  adminController.cleanupAnonymousSessions
)

export default admin
