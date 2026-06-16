/**
 * Admin Dashboard Controller — Core Operations
 *
 * Dashboard statistics, document CRUD, and user management. Handlers validate
 * input, call adminStats.service, and shape the response. Analytics and audit
 * endpoints are split into separate files and re-exported here (barrel pattern)
 * so the router import stays unchanged.
 */

import { adminLogger } from '../../lib/logger'
import type { AppContext } from '../../types/hono.types'
import * as stats from '../services/adminStats.service'
import { getSupabaseClient } from '../utils/supabase'

// Re-export split controllers (barrel pattern — router import stays unchanged)
export * from './admin-analytics.controller'
export * from './admin-audit.controller'
export * from './admin-stats.controller'

// =============================================================================
// Dashboard & Document Statistics
// =============================================================================

/**
 * Get overall dashboard statistics
 */
export async function getDashboardStats(c: AppContext) {
  try {
    return c.json(await stats.getDashboardStats(c.get('prisma')))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get dashboard stats')
    return c.json({ error: 'Failed to fetch statistics' }, 500)
  }
}

/**
 * Get document-specific statistics
 */
export async function getDocumentStats(c: AppContext) {
  try {
    return c.json(await stats.getDocumentStats(c.get('prisma')))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get document stats')
    return c.json({ error: 'Failed to fetch document statistics' }, 500)
  }
}

// =============================================================================
// Document CRUD
// =============================================================================

/**
 * List documents with pagination, sorting, including owner and member count.
 */
export async function listDocuments(c: AppContext) {
  try {
    const result = await stats.listDocuments(c.get('prisma'), {
      page: parseInt(c.req.query('page') || '1'),
      limit: Math.min(parseInt(c.req.query('limit') || '20'), 100),
      sortBy: c.req.query('sortBy') || 'updatedAt',
      sortDir: c.req.query('sortDir') === 'asc' ? 'asc' : 'desc',
      search: c.req.query('search') || ''
    })
    return c.json(result)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to list documents')
    return c.json({ error: 'Failed to fetch documents' }, 500)
  }
}

/**
 * Update document flags (isPrivate, readOnly)
 */
export async function updateDocument(c: AppContext) {
  try {
    const idRaw = c.req.param('id')
    if (idRaw === undefined) return c.json({ error: 'Missing document ID' }, 400)
    const id = parseInt(idRaw, 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const body = await c.req.json()
    const updateData: Record<string, boolean> = {}
    for (const field of ['isPrivate', 'readOnly']) {
      if (typeof body[field] === 'boolean') updateData[field] = body[field]
    }
    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    return c.json(await stats.updateDocumentFlags(c.get('prisma'), id, updateData))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to update document')
    return c.json({ error: 'Failed to update document' }, 500)
  }
}

/**
 * Get deletion impact — check what will be deleted (workspace, channels)
 */
export async function getDocumentDeletionImpact(c: AppContext) {
  try {
    const idRaw = c.req.param('id')
    if (idRaw === undefined) return c.json({ error: 'Missing document ID' }, 400)
    const id = parseInt(idRaw, 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const impact = await stats.getDocumentDeletionImpact(c.get('prisma'), id)
    if (!impact) return c.json({ error: 'Document not found' }, 404)
    return c.json(impact)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get deletion impact')
    return c.json({ error: 'Failed to analyze deletion impact' }, 500)
  }
}

/**
 * Delete document and all related data across both databases.
 */
export async function deleteDocument(c: AppContext) {
  try {
    const idRaw = c.req.param('id')
    if (idRaw === undefined) return c.json({ error: 'Missing document ID' }, 400)
    const id = parseInt(idRaw, 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const body = await c.req.json().catch(() => ({}))
    const result = await stats.deleteDocument(c.get('prisma'), id, body.confirmSlug)

    if (result.status === 'not_found') return c.json({ error: 'Document not found' }, 404)
    if (result.status === 'mismatch') {
      return c.json({ error: 'Confirmation slug does not match' }, 400)
    }
    return c.json({
      success: result.success,
      deleted: result.deleted,
      workspaceDeleted: result.workspaceDeleted
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to delete document')
    return c.json({ error: 'Failed to delete document' }, 500)
  }
}

/**
 * Get document counts per user (for Users page)
 */
export async function getUserDocumentCounts(c: AppContext) {
  try {
    return c.json(await stats.getUserDocumentCounts(c.get('prisma')))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get user document counts')
    return c.json({ error: 'Failed to fetch user document counts' }, 500)
  }
}

// =============================================================================
// Admin Role Management
// =============================================================================

/**
 * Toggle admin role for a user.
 * Self-demotion is blocked. Last-admin removal is blocked.
 */
export async function toggleAdminRole(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const userId = c.req.param('id')
    if (!userId) return c.json({ error: 'Missing user id' }, 400)
    const currentAdminId = c.get('userId')
    if (userId === currentAdminId) {
      return c.json({ error: 'Cannot change your own admin status' }, 403)
    }

    const result = await stats.toggleAdminRole(supabase, userId, currentAdminId)
    if (result.status === 'last_admin') {
      return c.json({ error: 'Cannot remove the last admin' }, 403)
    }
    if (result.status === 'error') return c.json({ error: result.message }, 500)
    return c.json({ success: true, is_admin: result.is_admin })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to toggle admin role')
    return c.json({ error: 'Failed to toggle admin role' }, 500)
  }
}

/**
 * Fetch all admin user IDs (lightweight — just the IDs for badge rendering)
 */
export async function getAdminUserIds(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const result = await stats.getAdminUserIds(supabase)
    if (result.status === 'error') return c.json({ error: result.message }, 500)
    return c.json(result.data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to fetch admin user IDs')
    return c.json({ error: 'Failed to fetch admin users' }, 500)
  }
}
