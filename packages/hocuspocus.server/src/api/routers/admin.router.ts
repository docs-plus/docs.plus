import { Hono } from 'hono'
import * as adminController from '../controllers/admin.controller'
import { adminAuthMiddleware } from '../middleware/adminAuth'

const admin = new Hono()

// Apply admin authentication middleware to all routes
admin.use('*', adminAuthMiddleware)

// Get dashboard statistics
admin.get('/stats', adminController.getDashboardStats)

// Get document counts per user (for Users page)
admin.get('/users/document-counts', adminController.getUserDocumentCounts)

// Get document statistics (from Prisma)
admin.get('/documents/stats', adminController.getDocumentStats)

// List documents with pagination
admin.get('/documents', adminController.listDocuments)

// Update document flags
admin.patch('/documents/:id', adminController.updateDocument)

// Get deletion impact (what will be deleted)
admin.get('/documents/:id/deletion-impact', adminController.getDocumentDeletionImpact)

// Delete document (requires confirmSlug in body)
admin.delete('/documents/:id', adminController.deleteDocument)

// =============================================================================
// Document View Analytics
// =============================================================================

// Get overall view statistics summary
admin.get('/stats/views', adminController.getViewsSummary)

// Get top viewed documents
admin.get('/stats/views/top', adminController.getTopViewedDocuments)

// Get view trends (for charts)
admin.get('/stats/views/trend', adminController.getViewsTrend)

// Get single document view stats
admin.get('/documents/:slug/views', adminController.getDocumentViewStats)

// =============================================================================
// User Retention Analytics
// =============================================================================

// Get retention metrics (DAU/WAU/MAU)
admin.get('/stats/retention', adminController.getRetentionMetrics)

// Get user lifecycle segments
admin.get('/stats/user-lifecycle', adminController.getUserLifecycleSegments)

// Get DAU trend
admin.get('/stats/dau-trend', adminController.getDauTrend)

// Get activity by hour (for heatmap)
admin.get('/stats/activity-heatmap', adminController.getActivityByHour)

// Get top active documents (by messages)
admin.get('/stats/top-active-documents', adminController.getTopActiveDocuments)

// Get communication stats
admin.get('/stats/communication', adminController.getCommunicationStats)

// Get notification reach
admin.get('/stats/notification-reach', adminController.getNotificationReach)

export default admin
