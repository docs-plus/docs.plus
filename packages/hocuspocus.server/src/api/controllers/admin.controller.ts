/**
 * Admin Dashboard Controller — Core Operations
 *
 * Dashboard statistics, document CRUD, and user management.
 * Analytics and audit endpoints are split into separate files
 * and re-exported here (barrel pattern) so the router import stays unchanged.
 */

import { adminLogger } from '../../lib/logger'
import { parseSupabaseArray, supabaseUsersArraySchema } from '../../schemas/supabase.schema'
import type { AppContext } from '../../types/hono.types'
import { getSupabaseClient, supabaseRest } from '../utils/supabase'

// Re-export split controllers (barrel pattern — router import stays unchanged)
export * from './admin-analytics.controller'
export * from './admin-audit.controller'

// =============================================================================
// Dashboard & Document Statistics
// =============================================================================

/**
 * Get overall dashboard statistics
 * Aggregates data from Prisma (documents)
 */
export async function getDashboardStats(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const [totalDocuments, privateDocuments, readOnlyDocuments, totalVersions, recentDocuments] =
      await Promise.all([
        prisma.documentMetadata.count(),
        prisma.documentMetadata.count({ where: { isPrivate: true } }),
        prisma.documentMetadata.count({ where: { readOnly: true } }),
        prisma.documents.count(),
        prisma.documentMetadata.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ])

    return c.json({
      documents: {
        total: totalDocuments,
        private: privateDocuments,
        readOnly: readOnlyDocuments,
        totalVersions,
        recentlyCreated: recentDocuments,
        avgVersionsPerDoc: totalDocuments > 0 ? Math.round(totalVersions / totalDocuments) : 0
      },
      refreshedAt: new Date().toISOString()
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get dashboard stats')
    return c.json({ error: 'Failed to fetch statistics' }, 500)
  }
}

/**
 * Get document-specific statistics
 */
export async function getDocumentStats(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const [total, privateCount, readOnlyCount, totalVersions] = await Promise.all([
      prisma.documentMetadata.count(),
      prisma.documentMetadata.count({ where: { isPrivate: true } }),
      prisma.documentMetadata.count({ where: { readOnly: true } }),
      prisma.documents.count()
    ])

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentDocs = await prisma.documentMetadata.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: sevenDaysAgo }
      },
      _count: true
    })

    return c.json({
      total,
      private: privateCount,
      readOnly: readOnlyCount,
      totalVersions,
      avgVersionsPerDoc: total > 0 ? Math.round(totalVersions / total) : 0,
      recentActivity: recentDocs.length
    })
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
 * Enriches Prisma data with Supabase PostgREST lookups.
 */
export async function listDocuments(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    const skip = (page - 1) * limit
    const sortBy = c.req.query('sortBy') || 'updatedAt'
    const sortDir = c.req.query('sortDir') === 'asc' ? 'asc' : 'desc'
    const search = c.req.query('search') || ''

    const sortFieldMap: Record<string, string> = {
      title: 'title',
      updatedAt: 'updatedAt',
      createdAt: 'createdAt',
      versionCount: 'updatedAt'
    }
    const orderField = sortFieldMap[sortBy] || 'updatedAt'

    const whereClause = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } }
          ]
        }
      : {}

    const [documents, total] = await Promise.all([
      prisma.documentMetadata.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [orderField]: sortDir },
        select: {
          id: true,
          slug: true,
          documentId: true,
          title: true,
          description: true,
          isPrivate: true,
          readOnly: true,
          createdAt: true,
          updatedAt: true,
          ownerId: true,
          email: true,
          _count: { select: { documents: true } }
        }
      }),
      prisma.documentMetadata.count({ where: whereClause })
    ])

    const docsWithDefaults = documents.map((doc) => ({
      id: doc.id,
      docId: doc.slug,
      documentId: doc.documentId,
      title: doc.title,
      headline: doc.description,
      isPrivate: doc.isPrivate,
      readOnly: doc.readOnly,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      versionCount: doc._count.documents,
      ownerId: doc.ownerId,
      ownerEmail: doc.email,
      ownerName: null as string | null,
      ownerAvatarUrl: null as string | null,
      ownerAvatarUpdatedAt: null as string | null,
      memberCount: 0,
      views7d: 0,
      uniqueUsers7d: 0
    }))

    // --- Enrich with Supabase data ---

    const ownerIds = [...new Set(documents.filter((d) => d.ownerId).map((d) => d.ownerId))]
    const slugs = documents.map((d) => d.slug)

    // Batch fetch owners (including avatar info)
    if (ownerIds.length > 0) {
      try {
        const quotedIds = ownerIds.map((id) => `"${id}"`).join(',')
        const res = await supabaseRest(
          `users?id=in.(${quotedIds})&select=id,username,email,avatar_url,avatar_updated_at`
        )
        if (res) {
          const usersRaw = await res.json()
          const users = parseSupabaseArray(supabaseUsersArraySchema, usersRaw)

          if (users) {
            const userMap = new Map(users.map((u) => [u.id, u]))
            docsWithDefaults.forEach((doc) => {
              if (doc.ownerId) {
                const user = userMap.get(doc.ownerId)
                if (user) {
                  doc.ownerName = user.username || user.email?.split('@')[0] || null
                  doc.ownerAvatarUrl = user.avatar_url || null
                  doc.ownerAvatarUpdatedAt = user.avatar_updated_at || null
                }
              }
            })
          }
        }
      } catch (err) {
        adminLogger.error({ err }, 'Failed to fetch owners')
      }
    }

    // Batch fetch workspaces and member counts
    if (slugs.length > 0) {
      try {
        const quotedSlugs = slugs.map((s) => `"${s}"`).join(',')
        const workspacesRes = await supabaseRest(
          `workspaces?slug=in.(${quotedSlugs})&select=id,slug`
        )
        if (workspacesRes) {
          const workspaces = await workspacesRes.json()

          if (Array.isArray(workspaces) && workspaces.length > 0) {
            const workspaceIds = workspaces.map((w: { id: string }) => w.id)
            const slugToWorkspaceId = new Map(
              workspaces.map((w: { id: string; slug: string }) => [w.slug, w.id])
            )

            const quotedWorkspaceIds = workspaceIds.map((id: string) => `"${id}"`).join(',')
            const membersRes = await supabaseRest(
              `workspace_members?workspace_id=in.(${quotedWorkspaceIds})&left_at=is.null&select=workspace_id`
            )
            if (membersRes) {
              const members = await membersRes.json()
              if (Array.isArray(members)) {
                const memberCounts = new Map<string, number>()
                members.forEach((m: { workspace_id: string }) => {
                  memberCounts.set(m.workspace_id, (memberCounts.get(m.workspace_id) || 0) + 1)
                })
                docsWithDefaults.forEach((doc) => {
                  const workspaceId = slugToWorkspaceId.get(doc.docId)
                  if (workspaceId) doc.memberCount = memberCounts.get(workspaceId) || 0
                })
              }
            }
          }
        }
      } catch (err) {
        adminLogger.error({ err }, 'Failed to fetch member counts')
      }
    }

    // Batch fetch view stats
    if (slugs.length > 0) {
      try {
        const quotedSlugs = slugs.map((s) => `"${s}"`).join(',')
        const res = await supabaseRest(
          `document_view_stats?document_slug=in.(${quotedSlugs})&select=document_slug,views_7d,unique_users_7d`
        )
        if (res) {
          const viewStats = await res.json()
          if (Array.isArray(viewStats)) {
            const statsMap = new Map(
              viewStats.map(
                (s: { document_slug: string; views_7d: number; unique_users_7d: number }) => [
                  s.document_slug,
                  { views7d: s.views_7d, uniqueUsers7d: s.unique_users_7d }
                ]
              )
            )
            docsWithDefaults.forEach((doc) => {
              const stats = statsMap.get(doc.docId)
              if (stats) {
                doc.views7d = stats.views7d
                doc.uniqueUsers7d = stats.uniqueUsers7d
              }
            })
          }
        }
      } catch (err) {
        adminLogger.error({ err }, 'Failed to fetch view stats')
      }
    }

    return c.json({
      data: docsWithDefaults.map((doc) => ({
        id: doc.id,
        docId: doc.docId,
        documentId: doc.documentId,
        title: doc.title,
        headline: doc.headline,
        isPrivate: doc.isPrivate,
        readOnly: doc.readOnly,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        versionCount: doc.versionCount,
        ownerId: doc.ownerId,
        ownerName: doc.ownerName,
        ownerEmail: doc.ownerEmail,
        ownerAvatarUrl: doc.ownerAvatarUrl,
        ownerAvatarUpdatedAt: doc.ownerAvatarUpdatedAt,
        memberCount: doc.memberCount,
        views7d: doc.views7d,
        uniqueUsers7d: doc.uniqueUsers7d
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to list documents')
    return c.json({ error: 'Failed to fetch documents' }, 500)
  }
}

/**
 * Update document flags (isPrivate, readOnly)
 */
export async function updateDocument(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const body = await c.req.json()

    const allowedFields = ['isPrivate', 'readOnly']
    const updateData: Record<string, boolean> = {}
    for (const field of allowedFields) {
      if (typeof body[field] === 'boolean') updateData[field] = body[field]
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    const document = await prisma.documentMetadata.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        slug: true,
        title: true,
        isPrivate: true,
        readOnly: true,
        updatedAt: true
      }
    })

    return c.json({
      success: true,
      document: {
        id: document.id,
        docId: document.slug,
        title: document.title,
        isPrivate: document.isPrivate,
        readOnly: document.readOnly,
        updatedAt: document.updatedAt
      }
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to update document')
    return c.json({ error: 'Failed to update document' }, 500)
  }
}

/**
 * Get deletion impact — check what will be deleted (workspace, channels)
 */
export async function getDocumentDeletionImpact(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const document = await prisma.documentMetadata.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } }
    })

    if (!document) return c.json({ error: 'Document not found' }, 404)

    let workspace: { id: string; channelCount: number } | null = null
    let owner: { username: string | null; email: string | null } | null = null

    // Fetch workspace and channel count
    try {
      const workspaceRes = await supabaseRest(`workspaces?slug=eq.${document.slug}&select=id`)
      if (workspaceRes) {
        const workspaces = await workspaceRes.json()
        if (Array.isArray(workspaces) && workspaces.length > 0) {
          const workspaceId = workspaces[0].id
          const channelsRes = await supabaseRest(
            `channels?workspace_id=eq.${workspaceId}&select=id`
          )
          const channels = channelsRes ? await channelsRes.json() : []
          workspace = {
            id: workspaceId,
            channelCount: Array.isArray(channels) ? channels.length : 0
          }
        }
      }
    } catch (err) {
      adminLogger.error({ err }, 'Failed to fetch workspace')
    }

    // Fetch owner info
    if (document.ownerId) {
      try {
        const userRes = await supabaseRest(`users?id=eq.${document.ownerId}&select=username,email`)
        if (userRes) {
          const users = await userRes.json()
          if (Array.isArray(users) && users.length > 0) {
            owner = { username: users[0].username, email: users[0].email }
          }
        }
      } catch (err) {
        adminLogger.error({ err }, 'Failed to fetch owner')
      }
    }

    if (!owner && document.email) {
      owner = { username: null, email: document.email }
    }

    return c.json({
      document: {
        id: document.id,
        slug: document.slug,
        title: document.title,
        versionCount: document._count.documents,
        createdAt: document.createdAt
      },
      owner,
      workspace
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get deletion impact')
    return c.json({ error: 'Failed to analyze deletion impact' }, 500)
  }
}

/**
 * Delete document and all related data across both databases.
 * Uses database CASCADE to automatically clean up related Supabase data.
 */
export async function deleteDocument(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const body = await c.req.json().catch(() => ({}))
    const confirmSlug = body.confirmSlug

    const document = await prisma.documentMetadata.findUnique({
      where: { id },
      select: { id: true, slug: true, title: true, documentId: true }
    })

    if (!document) return c.json({ error: 'Document not found' }, 404)

    if (confirmSlug !== document.slug) {
      return c.json({ error: 'Confirmation slug does not match' }, 400)
    }

    // Step 1: Delete workspace in Supabase (CASCADE handles channels, messages)
    let workspaceDeleted = false
    try {
      const deleteRes = await supabaseRest(`workspaces?slug=eq.${document.slug}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      })
      workspaceDeleted = deleteRes?.ok ?? false
    } catch (err) {
      adminLogger.error({ err }, 'Failed to delete workspace')
    }

    // Step 2: Delete document in Prisma (versions first, then metadata)
    await prisma.$transaction([
      prisma.documents.deleteMany({ where: { documentId: document.documentId } }),
      prisma.documentMetadata.delete({ where: { id } })
    ])

    return c.json({
      success: true,
      deleted: { id: document.id, slug: document.slug, title: document.title },
      workspaceDeleted
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
  const prisma = c.get('prisma')
  try {
    const counts = await prisma.documentMetadata.groupBy({
      by: ['ownerId'],
      _count: { id: true },
      where: { ownerId: { not: null } }
    })

    const result: Record<string, number> = {}
    counts.forEach((row) => {
      if (row.ownerId) result[row.ownerId] = row._count.id
    })

    return c.json(result)
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
    const currentAdminId = c.get('userId')

    if (userId === currentAdminId) {
      return c.json({ error: 'Cannot change your own admin status' }, 403)
    }

    const { data: existing } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      const { count } = await supabase
        .from('admin_users')
        .select('user_id', { count: 'exact', head: true })
      if ((count ?? 0) <= 1) {
        return c.json({ error: 'Cannot remove the last admin' }, 403)
      }

      const { error } = await supabase.from('admin_users').delete().eq('user_id', userId)
      if (error) return c.json({ error: error.message }, 500)
      return c.json({ success: true, is_admin: false })
    } else {
      const { error } = await supabase.from('admin_users').insert({
        user_id: userId,
        created_by: currentAdminId || null
      })
      if (error) return c.json({ error: error.message }, 500)
      return c.json({ success: true, is_admin: true })
    }
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

    const { data, error } = await supabase.from('admin_users').select('user_id, created_at')
    if (error) return c.json({ error: error.message }, 500)

    return c.json(data || [])
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to fetch admin user IDs')
    return c.json({ error: 'Failed to fetch admin users' }, 500)
  }
}
