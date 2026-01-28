import type { Context } from 'hono'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

// Supabase client for view stats (uses service role for RPC calls)
const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Get overall dashboard statistics
 * Aggregates data from Prisma (documents)
 */
export async function getDashboardStats(c: Context) {
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
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
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
    console.error('Failed to get dashboard stats:', error)
    return c.json({ error: 'Failed to fetch statistics' }, 500)
  }
}

/**
 * Get document-specific statistics
 */
export async function getDocumentStats(c: Context) {
  try {
    const [total, privateCount, readOnlyCount, totalVersions] = await Promise.all([
      prisma.documentMetadata.count(),
      prisma.documentMetadata.count({ where: { isPrivate: true } }),
      prisma.documentMetadata.count({ where: { readOnly: true } }),
      prisma.documents.count()
    ])

    // Get documents created per day for last 7 days
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
    console.error('Failed to get document stats:', error)
    return c.json({ error: 'Failed to fetch document statistics' }, 500)
  }
}

/**
 * List documents with pagination, sorting, including owner and member count
 */
export async function listDocuments(c: Context) {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    const skip = (page - 1) * limit
    const sortBy = c.req.query('sortBy') || 'updatedAt'
    const sortDir = c.req.query('sortDir') === 'asc' ? 'asc' : 'desc'
    const search = c.req.query('search') || ''

    // Map frontend keys to Prisma fields
    const sortFieldMap: Record<string, string> = {
      title: 'title',
      updatedAt: 'updatedAt',
      createdAt: 'createdAt',
      versionCount: 'updatedAt' // Can't sort by _count, fallback to updatedAt
    }
    const orderField = sortFieldMap[sortBy] || 'updatedAt'

    // Build search filter
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
          _count: {
            select: { documents: true }
          }
        }
      }),
      prisma.documentMetadata.count({ where: whereClause })
    ])

    // Prepare data with defaults
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
      memberCount: 0
    }))

    // Batch fetch owner names and member counts from Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
      const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }

      // Get unique owner IDs
      const ownerIds = [...new Set(documents.filter((d) => d.ownerId).map((d) => d.ownerId))]
      const slugs = documents.map((d) => d.slug)

      // Batch fetch owners (including avatar info)
      if (ownerIds.length > 0) {
        try {
          // Quote UUIDs for PostgREST in.() operator
          const quotedIds = ownerIds.map((id) => `"${id}"`).join(',')
          const queryUrl = `${supabaseUrl}/rest/v1/users?id=in.(${quotedIds})&select=id,username,email,avatar_url,avatar_updated_at`
          console.log('[Admin] Fetching owners from:', queryUrl)
          console.log('[Admin] Owner IDs from Prisma:', ownerIds)

          const usersRes = await fetch(queryUrl, { headers })
          const users = await usersRes.json()
          console.log('[Admin] Supabase response:', JSON.stringify(users, null, 2))
          if (Array.isArray(users)) {
            const userMap = new Map(
              users.map(
                (u: {
                  id: string
                  username: string | null
                  email: string | null
                  avatar_url: string | null
                  avatar_updated_at: string | null
                }) => [u.id, u]
              )
            )
            console.log('[Admin] User map keys:', [...userMap.keys()])

            docsWithDefaults.forEach((doc) => {
              if (doc.ownerId) {
                const user = userMap.get(doc.ownerId)
                console.log(
                  `[Admin] Doc ${doc.docId}: ownerId=${doc.ownerId}, found user=${!!user}`
                )
                if (user) {
                  doc.ownerName = user.username || user.email?.split('@')[0] || null
                  // Return raw avatar data for frontend to handle fallback chain
                  doc.ownerAvatarUrl = user.avatar_url || null
                  doc.ownerAvatarUpdatedAt = user.avatar_updated_at || null
                  console.log(
                    `[Admin] Mapped owner: name=${doc.ownerName}, avatarUrl=${doc.ownerAvatarUrl}, avatarUpdatedAt=${doc.ownerAvatarUpdatedAt}`
                  )
                }
              }
            })
          }
        } catch (err) {
          console.error('Failed to fetch owners:', err)
        }
      }

      // Batch fetch workspaces and member counts
      if (slugs.length > 0) {
        try {
          // Quote slugs for PostgREST in.() operator
          const quotedSlugs = slugs.map((s) => `"${s}"`).join(',')
          // Get workspaces by slugs
          const workspacesRes = await fetch(
            `${supabaseUrl}/rest/v1/workspaces?slug=in.(${quotedSlugs})&select=id,slug`,
            { headers }
          )
          const workspaces = await workspacesRes.json()

          if (Array.isArray(workspaces) && workspaces.length > 0) {
            const workspaceIds = workspaces.map((w: { id: string }) => w.id)
            const slugToWorkspaceId = new Map(
              workspaces.map((w: { id: string; slug: string }) => [w.slug, w.id])
            )

            // Get member counts (only active members where left_at is null)
            const quotedWorkspaceIds = workspaceIds.map((id) => `"${id}"`).join(',')
            const membersRes = await fetch(
              `${supabaseUrl}/rest/v1/workspace_members?workspace_id=in.(${quotedWorkspaceIds})&left_at=is.null&select=workspace_id`,
              { headers }
            )
            const members = await membersRes.json()

            if (Array.isArray(members)) {
              // Count active members per workspace
              const memberCounts = new Map<string, number>()
              members.forEach((m: { workspace_id: string }) => {
                memberCounts.set(m.workspace_id, (memberCounts.get(m.workspace_id) || 0) + 1)
              })

              // Map back to documents
              docsWithDefaults.forEach((doc) => {
                const workspaceId = slugToWorkspaceId.get(doc.docId)
                if (workspaceId) {
                  doc.memberCount = memberCounts.get(workspaceId) || 0
                }
              })
            }
          }
        } catch (err) {
          console.error('Failed to fetch member counts:', err)
        }
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
        memberCount: doc.memberCount
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Failed to list documents:', error)
    return c.json({ error: 'Failed to fetch documents' }, 500)
  }
}

/**
 * Update document flags (isPrivate, readOnly)
 */
export async function updateDocument(c: Context) {
  try {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid document ID' }, 400)
    }

    const body = await c.req.json()

    // Only allow updating specific fields
    const allowedFields = ['isPrivate', 'readOnly']
    const updateData: Record<string, boolean> = {}

    for (const field of allowedFields) {
      if (typeof body[field] === 'boolean') {
        updateData[field] = body[field]
      }
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
    console.error('Failed to update document:', error)
    return c.json({ error: 'Failed to update document' }, 500)
  }
}

/**
 * Get deletion impact - check what will be deleted with owner and channel info
 * Leverages database CASCADE deletes, so we only need to check if workspace exists
 */
export async function getDocumentDeletionImpact(c: Context) {
  try {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid document ID' }, 400)
    }

    // Get document info from Prisma (including owner fields)
    const document = await prisma.documentMetadata.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } }
    })

    if (!document) {
      return c.json({ error: 'Document not found' }, 404)
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const headers = { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey}` }

    let workspace: { id: string; channelCount: number } | null = null
    let owner: { username: string | null; email: string | null } | null = null

    if (supabaseUrl && supabaseKey) {
      // Fetch workspace and channel count
      try {
        const workspaceRes = await fetch(
          `${supabaseUrl}/rest/v1/workspaces?slug=eq.${document.slug}&select=id`,
          { headers }
        )
        const workspaces = await workspaceRes.json()

        if (Array.isArray(workspaces) && workspaces.length > 0) {
          const workspaceId = workspaces[0].id

          // Get channel count
          const channelsRes = await fetch(
            `${supabaseUrl}/rest/v1/channels?workspace_id=eq.${workspaceId}&select=id`,
            { headers }
          )
          const channels = await channelsRes.json()

          workspace = {
            id: workspaceId,
            channelCount: Array.isArray(channels) ? channels.length : 0
          }
        }
      } catch (err) {
        console.error('Failed to fetch workspace:', err)
      }

      // Fetch owner info if ownerId exists
      if (document.ownerId) {
        try {
          const userRes = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${document.ownerId}&select=username,email`,
            { headers }
          )
          const users = await userRes.json()
          if (Array.isArray(users) && users.length > 0) {
            owner = { username: users[0].username, email: users[0].email }
          }
        } catch (err) {
          console.error('Failed to fetch owner:', err)
        }
      }

      // Fallback to email from Prisma if no owner found
      if (!owner && document.email) {
        owner = { username: null, email: document.email }
      }
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
    console.error('Failed to get deletion impact:', error)
    return c.json({ error: 'Failed to analyze deletion impact' }, 500)
  }
}

/**
 * Delete document and all related data across both databases
 * Uses database CASCADE to automatically clean up related Supabase data
 */
export async function deleteDocument(c: Context) {
  try {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) {
      return c.json({ error: 'Invalid document ID' }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const confirmSlug = body.confirmSlug

    // Get document info
    const document = await prisma.documentMetadata.findUnique({
      where: { id },
      select: { id: true, slug: true, title: true, documentId: true }
    })

    if (!document) {
      return c.json({ error: 'Document not found' }, 404)
    }

    // Require confirmation by typing the slug
    if (confirmSlug !== document.slug) {
      return c.json({ error: 'Confirmation slug does not match' }, 400)
    }

    // Step 1: Delete workspace in Supabase (CASCADE handles channels, messages, etc.)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    let workspaceDeleted = false

    if (supabaseUrl && supabaseKey) {
      try {
        // Delete workspace by slug - CASCADE handles all related data
        const deleteRes = await fetch(
          `${supabaseUrl}/rest/v1/workspaces?slug=eq.${document.slug}`,
          {
            method: 'DELETE',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'return=minimal'
            }
          }
        )
        workspaceDeleted = deleteRes.ok
      } catch (err) {
        console.error('Failed to delete workspace:', err)
      }
    }

    // Step 2: Delete document in Prisma (versions first via documentId, then metadata)
    await prisma.$transaction([
      prisma.documents.deleteMany({ where: { documentId: document.documentId } }),
      prisma.documentMetadata.delete({ where: { id } })
    ])

    return c.json({
      success: true,
      deleted: {
        id: document.id,
        slug: document.slug,
        title: document.title
      },
      workspaceDeleted
    })
  } catch (error) {
    console.error('Failed to delete document:', error)
    return c.json({ error: 'Failed to delete document' }, 500)
  }
}

/**
 * Get document counts per user (for Users page)
 */
export async function getUserDocumentCounts(c: Context) {
  try {
    // Group documents by ownerId and count
    const counts = await prisma.documentMetadata.groupBy({
      by: ['ownerId'],
      _count: { id: true },
      where: { ownerId: { not: null } }
    })

    // Convert to a simple map
    const result: Record<string, number> = {}
    counts.forEach((row) => {
      if (row.ownerId) {
        result[row.ownerId] = row._count.id
      }
    })

    return c.json(result)
  } catch (error) {
    console.error('Failed to get user document counts:', error)
    return c.json({ error: 'Failed to fetch user document counts' }, 500)
  }
}

// =============================================================================
// Document View Analytics Endpoints
// =============================================================================

/**
 * Get document views summary (overall stats)
 * Calls get_document_views_summary() RPC
 */
export async function getViewsSummary(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const { data, error } = await supabase.rpc('get_document_views_summary')

    if (error) {
      console.error('Failed to get views summary:', error)
      return c.json({ error: 'Failed to fetch view statistics' }, 500)
    }

    return c.json(data)
  } catch (error) {
    console.error('Failed to get views summary:', error)
    return c.json({ error: 'Failed to fetch view statistics' }, 500)
  }
}

/**
 * Get top viewed documents
 * Calls get_top_viewed_documents(limit, days) RPC
 */
export async function getTopViewedDocuments(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const limit = parseInt(c.req.query('limit') || '10')
    const days = parseInt(c.req.query('days') || '7')

    const { data, error } = await supabase.rpc('get_top_viewed_documents', {
      p_limit: Math.min(limit, 50),
      p_days: Math.min(days, 90)
    })

    if (error) {
      console.error('Failed to get top viewed documents:', error)
      return c.json({ error: 'Failed to fetch top documents' }, 500)
    }

    // Enrich with document titles from Prisma
    const slugs = (data || []).map((d: { document_slug: string }) => d.document_slug)
    const docs = await prisma.documentMetadata.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, title: true }
    })
    const titleMap = new Map(docs.map((d) => [d.slug, d.title]))

    const enrichedData = (data || []).map(
      (d: { document_slug: string; views: number; unique_users: number }) => ({
        ...d,
        title: titleMap.get(d.document_slug) || d.document_slug
      })
    )

    return c.json(enrichedData)
  } catch (error) {
    console.error('Failed to get top viewed documents:', error)
    return c.json({ error: 'Failed to fetch top documents' }, 500)
  }
}

/**
 * Get document views trend (daily data for charts)
 * Calls get_document_views_trend(slug, days) RPC
 */
export async function getViewsTrend(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const slug = c.req.query('slug') || null
    const days = parseInt(c.req.query('days') || '30')

    const { data, error } = await supabase.rpc('get_document_views_trend', {
      p_document_slug: slug,
      p_days: Math.min(days, 90)
    })

    if (error) {
      console.error('Failed to get views trend:', error)
      return c.json({ error: 'Failed to fetch trend data' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    console.error('Failed to get views trend:', error)
    return c.json({ error: 'Failed to fetch trend data' }, 500)
  }
}

/**
 * Get single document view stats
 * Calls get_document_view_stats(slug) RPC
 */
export async function getDocumentViewStats(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const slug = c.req.param('slug')
    if (!slug) {
      return c.json({ error: 'Document slug required' }, 400)
    }

    const { data, error } = await supabase.rpc('get_document_view_stats', {
      p_document_slug: slug
    })

    if (error) {
      console.error('Failed to get document view stats:', error)
      return c.json({ error: 'Failed to fetch document stats' }, 500)
    }

    return c.json(data)
  } catch (error) {
    console.error('Failed to get document view stats:', error)
    return c.json({ error: 'Failed to fetch document stats' }, 500)
  }
}

// =============================================================================
// User Retention Analytics Endpoints (Phase 8)
// =============================================================================

/**
 * Get retention metrics (DAU/WAU/MAU)
 */
export async function getRetentionMetrics(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const { data, error } = await supabase.rpc('get_retention_metrics')

    if (error) {
      console.error('Failed to get retention metrics:', error)
      return c.json({ error: 'Failed to fetch retention metrics' }, 500)
    }

    return c.json(data)
  } catch (error) {
    console.error('Failed to get retention metrics:', error)
    return c.json({ error: 'Failed to fetch retention metrics' }, 500)
  }
}

/**
 * Get user lifecycle segments
 */
export async function getUserLifecycleSegments(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const { data, error } = await supabase.rpc('get_user_lifecycle_segments')

    if (error) {
      console.error('Failed to get user lifecycle segments:', error)
      return c.json({ error: 'Failed to fetch lifecycle segments' }, 500)
    }

    return c.json(data)
  } catch (error) {
    console.error('Failed to get user lifecycle segments:', error)
    return c.json({ error: 'Failed to fetch lifecycle segments' }, 500)
  }
}

/**
 * Get DAU trend over time
 */
export async function getDauTrend(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const days = parseInt(c.req.query('days') || '30')

    const { data, error } = await supabase.rpc('get_dau_trend', {
      p_days: Math.min(days, 90)
    })

    if (error) {
      console.error('Failed to get DAU trend:', error)
      return c.json({ error: 'Failed to fetch DAU trend' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    console.error('Failed to get DAU trend:', error)
    return c.json({ error: 'Failed to fetch DAU trend' }, 500)
  }
}

/**
 * Get activity by hour (for heatmap)
 */
export async function getActivityByHour(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const days = parseInt(c.req.query('days') || '7')

    const { data, error } = await supabase.rpc('get_activity_by_hour', {
      p_days: Math.min(days, 30)
    })

    if (error) {
      console.error('Failed to get activity by hour:', error)
      return c.json({ error: 'Failed to fetch activity data' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    console.error('Failed to get activity by hour:', error)
    return c.json({ error: 'Failed to fetch activity data' }, 500)
  }
}

/**
 * Get top active documents
 */
export async function getTopActiveDocuments(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const limit = parseInt(c.req.query('limit') || '5')
    const days = parseInt(c.req.query('days') || '7')

    const { data, error } = await supabase.rpc('get_top_active_documents', {
      p_limit: Math.min(limit, 20),
      p_days: Math.min(days, 30)
    })

    if (error) {
      console.error('Failed to get top active documents:', error)
      return c.json({ error: 'Failed to fetch top documents' }, 500)
    }

    // Enrich with document titles from Prisma
    const slugs = (data || []).map((d: { document_slug: string }) => d.document_slug)
    const docs = await prisma.documentMetadata.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, title: true }
    })
    const titleMap = new Map(docs.map((d) => [d.slug, d.title]))

    const enrichedData = (data || []).map(
      (d: { document_slug: string; message_count: number; unique_users: number }) => ({
        ...d,
        title: titleMap.get(d.document_slug) || d.document_slug
      })
    )

    return c.json(enrichedData)
  } catch (error) {
    console.error('Failed to get top active documents:', error)
    return c.json({ error: 'Failed to fetch top documents' }, 500)
  }
}

/**
 * Get communication stats
 */
export async function getCommunicationStats(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const days = parseInt(c.req.query('days') || '7')

    const { data, error } = await supabase.rpc('get_communication_stats', {
      p_days: Math.min(days, 30)
    })

    if (error) {
      console.error('Failed to get communication stats:', error)
      return c.json({ error: 'Failed to fetch communication stats' }, 500)
    }

    return c.json(data)
  } catch (error) {
    console.error('Failed to get communication stats:', error)
    return c.json({ error: 'Failed to fetch communication stats' }, 500)
  }
}

/**
 * Get notification reach
 */
export async function getNotificationReach(c: Context) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const { data, error } = await supabase.rpc('get_notification_reach')

    if (error) {
      console.error('Failed to get notification reach:', error)
      return c.json({ error: 'Failed to fetch notification reach' }, 500)
    }

    return c.json(data)
  } catch (error) {
    console.error('Failed to get notification reach:', error)
    return c.json({ error: 'Failed to fetch notification reach' }, 500)
  }
}
