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
  paginationQuerySchema,
  staleDocumentsQuerySchema,
  trendQuerySchema,
  updateDocumentSchema
} from '../../schemas/admin.schema'
import * as adminController from '../controllers/admin.controller'
import { adminAuthMiddleware } from '../middleware/adminAuth'

const admin = new Hono()

// Apply admin authentication middleware to all routes
admin.use('*', adminAuthMiddleware)

// Get dashboard statistics
admin.get('/stats', adminController.getDashboardStats)

// Get document counts per user (for Users page)
admin.get('/users/document-counts', adminController.getUserDocumentCounts)

// Get all admin user IDs (for badge rendering in Users table)
admin.get('/users/admins', adminController.getAdminUserIds)

// Toggle admin role for a user (grant or revoke)
admin.post('/users/:id/toggle-admin', adminController.toggleAdminRole)

// Get document statistics (from Prisma)
admin.get('/documents/stats', adminController.getDocumentStats)

// List documents with pagination
admin.get(
  '/documents',
  zValidator('query', listDocumentsQuerySchema),
  adminController.listDocuments
)

// Update document flags
admin.patch(
  '/documents/:id',
  zValidator('json', updateDocumentSchema),
  adminController.updateDocument
)

// Get deletion impact (what will be deleted)
admin.get('/documents/:id/deletion-impact', adminController.getDocumentDeletionImpact)

// Delete document (requires confirmSlug in body)
admin.delete(
  '/documents/:id',
  zValidator('json', deleteDocumentSchema),
  adminController.deleteDocument
)

// =============================================================================
// Document View Analytics
// =============================================================================

// Get overall view statistics summary
admin.get('/stats/views', adminController.getViewsSummary)

// Get top viewed documents
admin.get(
  '/stats/views/top',
  zValidator('query', paginationQuerySchema),
  adminController.getTopViewedDocuments
)

// Get view trends (for charts)
admin.get(
  '/stats/views/trend',
  zValidator('query', trendQuerySchema),
  adminController.getViewsTrend
)

// Get single document view stats
admin.get('/documents/:slug/views', adminController.getDocumentViewStats)

// Get batch document trends (for sparklines in table)
admin.get(
  '/stats/views/batch-trends',
  zValidator('query', batchTrendsQuerySchema),
  adminController.getBatchDocumentTrends
)

// =============================================================================
// User Retention Analytics
// =============================================================================

// Get retention metrics (DAU/WAU/MAU)
admin.get('/stats/retention', adminController.getRetentionMetrics)

// Get user lifecycle segments
admin.get('/stats/user-lifecycle', adminController.getUserLifecycleSegments)

// Get DAU trend
admin.get('/stats/dau-trend', zValidator('query', daysQuerySchema), adminController.getDauTrend)

// Get activity by hour (for heatmap)
admin.get(
  '/stats/activity-heatmap',
  zValidator('query', daysQuerySchema),
  adminController.getActivityByHour
)

// Get top active documents (by messages)
admin.get(
  '/stats/top-active-documents',
  zValidator('query', paginationQuerySchema),
  adminController.getTopActiveDocuments
)

// Get communication stats
admin.get(
  '/stats/communication',
  zValidator('query', daysQuerySchema),
  adminController.getCommunicationStats
)

// Get notification reach
admin.get('/stats/notification-reach', adminController.getNotificationReach)

// =============================================================================
// Stale Documents Audit (Phase 13)
// =============================================================================

// Get stale documents summary
admin.get('/documents/stale/summary', adminController.getStaleDocumentsSummary)

// List stale documents with filters
admin.get(
  '/documents/stale',
  zValidator('query', staleDocumentsQuerySchema),
  adminController.listStaleDocuments
)

// Get document content preview
admin.get('/documents/:slug/preview', adminController.getDocumentPreview)

// Bulk delete stale documents
admin.post(
  '/documents/stale/bulk-delete',
  zValidator('json', bulkDeleteSchema),
  adminController.bulkDeleteStaleDocuments
)

// =============================================================================
// Failed Notifications Audit (Phase 17)
// =============================================================================

// Combined notification health score (push + email delivery rates)
admin.get('/audit/notifications/health', adminController.getNotificationHealth)

// Push failure breakdown by error category + platform
admin.get('/audit/notifications/push-failures', adminController.getPushFailureSummary)

// Email failure + bounce breakdown
admin.get('/audit/notifications/email-failures', adminController.getEmailFailureSummary)

// Detailed failed push subscriptions list
admin.get(
  '/audit/notifications/failed-subscriptions',
  zValidator('query', auditFailedSubsQuerySchema),
  adminController.getFailedPushSubscriptions
)

// Email bounce list with user info
admin.get(
  '/audit/notifications/email-bounces',
  zValidator('query', auditEmailBouncesQuerySchema),
  adminController.getEmailBounces
)

// Bulk disable expired/dead push subscriptions
admin.post(
  '/audit/notifications/disable-failed',
  zValidator('json', disableFailedSubsSchema),
  adminController.disableFailedSubscriptions
)

// BullMQ Dead Letter Queue contents (push + email)
admin.get('/audit/notifications/dlq', adminController.getDeadLetterQueueContents)

// =============================================================================
// Ghost Accounts Audit (Phase 15)
// =============================================================================

// List ghost accounts (detection via Admin API + public.users cross-ref)
admin.get(
  '/audit/ghost-accounts',
  zValidator('query', ghostAccountsQuerySchema),
  adminController.getGhostAccounts
)

// Summary stats across all ghost categories
admin.get('/audit/ghost-accounts/summary', adminController.getGhostAccountsSummary)

// FK dependency check before deleting a specific user
admin.get('/audit/ghost-accounts/:id/impact', adminController.getGhostDeletionImpact)

// Smart-delete single ghost (hard or soft based on FK deps)
admin.delete('/audit/ghost-accounts/:id', adminController.deleteGhostAccount)

// Bulk smart-delete ghost accounts (max 50)
admin.post(
  '/audit/ghost-accounts/bulk-delete',
  zValidator('json', ghostBulkDeleteSchema),
  adminController.bulkDeleteGhostAccounts
)

// Resend magic link confirmation for unconfirmed ghost
admin.post(
  '/audit/ghost-accounts/resend-confirmation',
  zValidator('json', ghostResendSchema),
  adminController.resendGhostConfirmation
)

// Bulk cleanup stale anonymous sessions
admin.post(
  '/audit/ghost-accounts/cleanup-anonymous',
  zValidator('json', ghostCleanupAnonymousSchema),
  adminController.cleanupAnonymousSessions
)

export default admin
