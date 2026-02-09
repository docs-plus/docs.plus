import { TiptapTransformer } from '@hocuspocus/transformer'
import { createClient } from '@supabase/supabase-js'
import * as Y from 'yjs'

import { config } from '../../config/env'
import { parseSupabaseArray, supabaseUsersArraySchema } from '../../schemas/supabase.schema'
import type { AppContext } from '../../types/hono.types'

// Supabase client for view stats (uses service role for RPC calls)
const getSupabaseClient = () => {
  const url = config.supabase.url
  const key = config.supabase.serviceRoleKey
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// =============================================================================
// Document Structure Analysis (Y.js parsing)
// =============================================================================

interface DocumentStructure {
  headings: number
  paragraphs: number
}

/**
 * Parse Y.js document data and count structural elements (headings, paragraphs)
 * Uses @hocuspocus/transformer to convert Y.js to ProseMirror JSON
 */
function parseDocumentStructure(data: Buffer | Uint8Array | null): DocumentStructure {
  const empty: DocumentStructure = { headings: 0, paragraphs: 0 }
  if (!data) return empty

  try {
    const ydoc = new Y.Doc()
    const buffer = data instanceof Buffer ? new Uint8Array(data) : data
    Y.applyUpdate(ydoc, buffer)

    const json = TiptapTransformer.fromYdoc(ydoc, 'default') as {
      type?: string
      content?: unknown[]
    } | null

    if (!json) return empty

    let headings = 0,
      paragraphs = 0

    function traverse(node: unknown): void {
      if (!node || typeof node !== 'object') return
      const n = node as { type?: string; content?: unknown[] }
      if (n.type === 'heading') headings++
      if (n.type === 'paragraph') paragraphs++
      if (Array.isArray(n.content)) n.content.forEach(traverse)
    }

    if (json.content && Array.isArray(json.content)) {
      json.content.forEach(traverse)
    }

    return { headings, paragraphs }
  } catch {
    return empty
  }
}

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
export async function getDocumentStats(c: AppContext) {
  const prisma = c.get('prisma')
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
export async function listDocuments(c: AppContext) {
  const prisma = c.get('prisma')
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
      memberCount: 0,
      views7d: 0,
      uniqueUsers7d: 0
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
          const usersRaw = await usersRes.json()
          const users = parseSupabaseArray(supabaseUsersArraySchema, usersRaw)

          if (users) {
            const userMap = new Map(users.map((u) => [u.id, u]))
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

      // Batch fetch view stats
      if (slugs.length > 0) {
        try {
          const quotedSlugs = slugs.map((s) => `"${s}"`).join(',')
          const viewStatsRes = await fetch(
            `${supabaseUrl}/rest/v1/document_view_stats?document_slug=in.(${quotedSlugs})&select=document_slug,views_7d,unique_users_7d`,
            { headers }
          )
          const viewStats = await viewStatsRes.json()

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
        } catch (err) {
          console.error('Failed to fetch view stats:', err)
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
        memberCount: doc.memberCount,
        views7d: doc.views7d,
        uniqueUsers7d: doc.uniqueUsers7d
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
export async function updateDocument(c: AppContext) {
  const prisma = c.get('prisma')
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
export async function getDocumentDeletionImpact(c: AppContext) {
  const prisma = c.get('prisma')
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
export async function deleteDocument(c: AppContext) {
  const prisma = c.get('prisma')
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
export async function getUserDocumentCounts(c: AppContext) {
  const prisma = c.get('prisma')
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
export async function getViewsSummary(c: AppContext) {
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
export async function getTopViewedDocuments(c: AppContext) {
  const prisma = c.get('prisma')
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
export async function getViewsTrend(c: AppContext) {
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
 * Get batch document view trends (for sparklines)
 * Returns last N days of views for multiple documents
 */
export async function getBatchDocumentTrends(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return c.json({ error: 'Supabase not configured' }, 500)
    }

    const slugsParam = c.req.query('slugs') || ''
    const days = parseInt(c.req.query('days') || '7')
    const slugs = slugsParam.split(',').filter(Boolean)

    if (slugs.length === 0) {
      return c.json({})
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    // Fetch daily views for all slugs in batch
    const { data, error } = await supabase
      .from('document_views_daily')
      .select('document_slug, view_date, views')
      .in('document_slug', slugs)
      .gte('view_date', startDateStr)
      .order('view_date', { ascending: true })

    if (error) {
      console.error('Failed to get batch trends:', error)
      return c.json({ error: 'Failed to fetch trend data' }, 500)
    }

    // Group by document slug and create arrays of daily views
    const trendsBySlug: Record<string, number[]> = {}
    slugs.forEach((slug) => {
      trendsBySlug[slug] = []
    })

    // Create a map of all dates we need
    const dateMap: Record<string, Record<string, number>> = {}
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      dateMap[dateStr] = {}
      slugs.forEach((slug) => {
        dateMap[dateStr][slug] = 0
      })
    }

    // Fill in actual data
    ;(data || []).forEach((row: { document_slug: string; view_date: string; views: number }) => {
      const dateStr =
        typeof row.view_date === 'string'
          ? row.view_date
          : new Date(row.view_date).toISOString().split('T')[0]
      if (dateMap[dateStr]) {
        dateMap[dateStr][row.document_slug] = row.views
      }
    })

    // Build arrays
    const sortedDates = Object.keys(dateMap).sort()
    slugs.forEach((slug) => {
      trendsBySlug[slug] = sortedDates.map((date) => dateMap[date][slug] || 0)
    })

    return c.json(trendsBySlug)
  } catch (error) {
    console.error('Failed to get batch trends:', error)
    return c.json({ error: 'Failed to fetch trend data' }, 500)
  }
}

/**
 * Get single document view stats
 * Calls get_document_view_stats(slug) RPC
 */
export async function getDocumentViewStats(c: AppContext) {
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
export async function getRetentionMetrics(c: AppContext) {
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
export async function getUserLifecycleSegments(c: AppContext) {
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
export async function getDauTrend(c: AppContext) {
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
export async function getActivityByHour(c: AppContext) {
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
export async function getTopActiveDocuments(c: AppContext) {
  const prisma = c.get('prisma')
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
export async function getCommunicationStats(c: AppContext) {
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
export async function getNotificationReach(c: AppContext) {
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

// =============================================================================
// Stale Documents Audit Endpoints (Phase 13)
// =============================================================================

// In-memory cache for summary stats (5 minute TTL)
let staleSummaryCache: { data: unknown; expiresAt: number } | null = null
const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// StaleDocumentRow type removed - now using inline types in the refactored queries

/**
 * Stale Detection Scoring (Industry Standard - Multi-Signal)
 *
 * Combines edit activity AND view activity to determine staleness:
 * - views_30d = 0 AND days_inactive > 90 → Truly Abandoned (100)
 * - views_7d = 0 AND version_count <= 1 → Ghost Document (90)
 * - views_7d = 0 AND days_inactive > 30 → Declining Interest (70)
 * - views_7d < 3 AND days_inactive > 60 → Low Engagement (50)
 * - Otherwise if low edits but has views → Not Stale (0)
 *
 * Key principle: A document being READ means it's still valuable,
 * even if it hasn't been edited recently.
 */

/**
 * Get stale documents summary statistics
 * Uses Prisma for doc stats + Supabase for view stats
 */
export async function getStaleDocumentsSummary(c: AppContext) {
  const prisma = c.get('prisma')

  // Check cache first
  if (staleSummaryCache && Date.now() < staleSummaryCache.expiresAt) {
    return c.json(staleSummaryCache.data)
  }

  try {
    // Step 1: Get document stats from Prisma
    const docStats = await prisma.$queryRaw<
      {
        slug: string
        version_count: bigint
        total_storage: bigint
        days_inactive: number
        age_days: number
      }[]
    >`
      SELECT
        dm.slug,
        COUNT(d.id) AS version_count,
        COALESCE(SUM(LENGTH(d.data::text)), 0) AS total_storage,
        EXTRACT(DAY FROM NOW() - dm."updatedAt")::integer AS days_inactive,
        EXTRACT(DAY FROM NOW() - dm."createdAt")::integer AS age_days
      FROM "DocumentMetadata" dm
      LEFT JOIN "Documents" d ON d."documentId" = dm."documentId"
      GROUP BY dm.id
    `

    // Step 2: Fetch view stats from Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const viewStatsMap = new Map<string, { views_7d: number; views_30d: number }>()

    if (supabaseUrl && supabaseKey && docStats.length > 0) {
      try {
        const slugs = docStats.map((d) => d.slug)
        const quotedSlugs = slugs.map((s) => `"${s}"`).join(',')
        const res = await fetch(
          `${supabaseUrl}/rest/v1/document_view_stats?document_slug=in.(${quotedSlugs})&select=document_slug,views_7d,views_30d`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`
            }
          }
        )
        const viewStats = await res.json()
        if (Array.isArray(viewStats)) {
          viewStats.forEach((v: { document_slug: string; views_7d: number; views_30d: number }) => {
            viewStatsMap.set(v.document_slug, {
              views_7d: v.views_7d || 0,
              views_30d: v.views_30d || 0
            })
          })
        }
      } catch (err) {
        console.error('Failed to fetch view stats for summary:', err)
      }
    }

    // Step 3: Calculate stale scores with view data
    let total_stale = 0
    let truly_abandoned = 0
    let ghost_document = 0
    let declining = 0
    let low_engagement = 0
    let recoverable_bytes = 0n

    for (const doc of docStats) {
      const views = viewStatsMap.get(doc.slug) || { views_7d: 0, views_30d: 0 }
      const versionCount = Number(doc.version_count)
      const daysInactive = doc.days_inactive

      // Industry-standard scoring: Combines edit + view signals
      let staleScore = 0

      if (views.views_30d === 0 && daysInactive > 90) {
        staleScore = 100 // Truly Abandoned: No views, no edits for 90+ days
        truly_abandoned++
      } else if (views.views_7d === 0 && versionCount <= 1) {
        staleScore = 90 // Ghost: Never viewed, barely edited
        ghost_document++
      } else if (views.views_7d === 0 && daysInactive > 30) {
        staleScore = 70 // Declining: No recent views, no recent edits
        declining++
      } else if (views.views_7d < 3 && daysInactive > 60) {
        staleScore = 50 // Low Engagement: Minimal activity
        low_engagement++
      }
      // If views_7d >= 3 OR recent edits → NOT stale (score = 0)

      if (staleScore > 0) {
        total_stale++
        recoverable_bytes += doc.total_storage
      }
    }

    const summary = {
      total_stale,
      truly_abandoned,
      ghost_document,
      declining,
      low_engagement,
      recoverable_bytes: Number(recoverable_bytes)
    }

    // Cache the result
    staleSummaryCache = {
      data: summary,
      expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS
    }

    return c.json(summary)
  } catch (error) {
    console.error('Failed to get stale documents summary:', error)
    return c.json({ error: 'Failed to fetch stale documents summary' }, 500)
  }
}

/**
 * List stale documents with pagination and filtering
 * Industry-standard: Combines edit activity + view activity for staleness detection
 */
export async function listStaleDocuments(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    const minScore = parseInt(c.req.query('minScore') || '0')
    const sortBy = c.req.query('sortBy') || 'stale_score'
    const sortDir = c.req.query('sortDir') === 'asc' ? 'asc' : 'desc'

    // Step 1: Get all documents with basic stats from Prisma
    const allDocs = await prisma.$queryRaw<
      {
        slug: string
        document_id: string
        title: string
        created_at: Date
        updated_at: Date
        is_private: boolean
        owner_id: string | null
        owner_email: string | null
        version_count: bigint
        days_inactive: number
        age_days: number
      }[]
    >`
      SELECT
        dm.slug,
        dm."documentId" AS document_id,
        dm.title,
        dm."createdAt" AS created_at,
        dm."updatedAt" AS updated_at,
        dm."isPrivate" AS is_private,
        dm."ownerId" AS owner_id,
        dm.email AS owner_email,
        COUNT(d.id) AS version_count,
        EXTRACT(DAY FROM NOW() - dm."updatedAt")::integer AS days_inactive,
        EXTRACT(DAY FROM NOW() - dm."createdAt")::integer AS age_days
      FROM "DocumentMetadata" dm
      LEFT JOIN "Documents" d ON d."documentId" = dm."documentId"
      GROUP BY dm.id
    `

    // Step 2: Fetch view stats from Supabase for all documents
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const viewStatsMap = new Map<
      string,
      { views_7d: number; views_30d: number; last_viewed_at: string | null }
    >()

    if (supabaseUrl && supabaseKey && allDocs.length > 0) {
      try {
        const slugs = allDocs.map((d) => d.slug)
        const quotedSlugs = slugs.map((s) => `"${s}"`).join(',')
        const res = await fetch(
          `${supabaseUrl}/rest/v1/document_view_stats?document_slug=in.(${quotedSlugs})&select=document_slug,views_7d,views_30d,last_viewed_at`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`
            }
          }
        )
        const viewStats = await res.json()
        if (Array.isArray(viewStats)) {
          viewStats.forEach(
            (v: {
              document_slug: string
              views_7d: number
              views_30d: number
              last_viewed_at: string | null
            }) => {
              viewStatsMap.set(v.document_slug, {
                views_7d: v.views_7d || 0,
                views_30d: v.views_30d || 0,
                last_viewed_at: v.last_viewed_at || null
              })
            }
          )
        }
      } catch (err) {
        console.error('Failed to fetch view stats:', err)
      }
    }

    // Step 3: Calculate stale scores using industry-standard multi-signal approach
    const scoredDocs = allDocs.map((doc) => {
      const views = viewStatsMap.get(doc.slug) || {
        views_7d: 0,
        views_30d: 0,
        last_viewed_at: null
      }
      const versionCount = Number(doc.version_count)
      const daysInactive = doc.days_inactive

      // Industry-standard scoring: Combines edit + view signals
      let stale_score = 0
      let stale_reason = ''

      if (views.views_30d === 0 && daysInactive > 90) {
        stale_score = 100
        stale_reason = 'Truly Abandoned' // No views AND no edits for 90+ days
      } else if (views.views_7d === 0 && versionCount <= 1) {
        stale_score = 90
        stale_reason = 'Ghost Document' // Never viewed, barely edited
      } else if (views.views_7d === 0 && daysInactive > 30) {
        stale_score = 70
        stale_reason = 'Declining Interest' // No recent views, no recent edits
      } else if (views.views_7d < 3 && daysInactive > 60) {
        stale_score = 50
        stale_reason = 'Low Engagement' // Minimal activity
      }
      // If views_7d >= 3 OR recent edits → NOT stale (score = 0)

      return {
        ...doc,
        version_count: versionCount,
        stale_score,
        stale_reason,
        views_7d: views.views_7d,
        views_30d: views.views_30d,
        last_viewed_at: views.last_viewed_at
      }
    })

    // Step 4: Filter and sort
    let filteredDocs = scoredDocs.filter((d) => d.stale_score >= minScore && d.stale_score > 0)

    // Sort
    const sortKey = sortBy as keyof (typeof filteredDocs)[0]
    filteredDocs.sort((a, b) => {
      const aVal = a[sortKey] ?? 0
      const bVal = b[sortKey] ?? 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal
      }
      return 0
    })

    // Paginate
    const total = filteredDocs.length
    const offset = (page - 1) * limit
    const paginatedDocs = filteredDocs.slice(offset, offset + limit)

    // Step 5: Fetch document binary data for structure parsing (only for current page)
    const documentIds = paginatedDocs.map((r) => r.document_id).filter(Boolean)
    const docDataMap = new Map<string, Buffer | null>()

    if (documentIds.length > 0) {
      const latestDocs = await prisma.$queryRaw<{ documentId: string; data: Buffer }[]>`
        SELECT DISTINCT ON ("documentId") "documentId", data
        FROM "Documents"
        WHERE "documentId" = ANY(${documentIds})
        ORDER BY "documentId", id DESC
      `
      latestDocs.forEach((doc) => {
        docDataMap.set(doc.documentId, doc.data)
      })
    }

    // Step 6: Format results with structure and views
    const results = paginatedDocs.map((row) => {
      const docData = docDataMap.get(row.document_id) || null
      const structure = parseDocumentStructure(docData)

      return {
        slug: row.slug,
        title: row.title,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        is_private: row.is_private,
        owner_id: row.owner_id,
        owner_email: row.owner_email,
        version_count: row.version_count,
        age_days: row.age_days,
        days_inactive: row.days_inactive,
        stale_score: row.stale_score,
        stale_reason: row.stale_reason,
        views_7d: row.views_7d,
        views_30d: row.views_30d,
        owner_name: null as string | null,
        owner_avatar_url: null as string | null,
        structure
      }
    })

    // Step 7: Enrich with owner info from Supabase
    if (supabaseUrl && supabaseKey) {
      const ownerIds = [...new Set(results.filter((d) => d.owner_id).map((d) => d.owner_id))]

      if (ownerIds.length > 0) {
        try {
          const quotedIds = ownerIds.map((id) => `"${id}"`).join(',')
          const usersRes = await fetch(
            `${supabaseUrl}/rest/v1/users?id=in.(${quotedIds})&select=id,username,email,avatar_url`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`
              }
            }
          )
          const users = await usersRes.json()

          if (Array.isArray(users)) {
            const userMap = new Map(
              users.map(
                (u: { id: string; username: string; email: string; avatar_url: string }) => [
                  u.id,
                  u
                ]
              )
            )
            results.forEach((doc) => {
              if (doc.owner_id) {
                const user = userMap.get(doc.owner_id)
                if (user) {
                  doc.owner_name = user.username || user.email?.split('@')[0] || null
                  doc.owner_avatar_url = user.avatar_url || null
                }
              }
            })
          }
        } catch (err) {
          console.error('Failed to fetch owners:', err)
        }
      }
    }

    return c.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Failed to list stale documents:', error)
    return c.json({ error: 'Failed to fetch stale documents' }, 500)
  }
}

/**
 * Get document content preview (first 500 chars)
 */
export async function getDocumentPreview(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const slug = c.req.param('slug')
    if (!slug) {
      return c.json({ error: 'Document slug required' }, 400)
    }

    // Get document metadata
    const doc = await prisma.documentMetadata.findUnique({
      where: { slug },
      include: { _count: { select: { documents: true } } }
    })

    if (!doc) {
      return c.json({ error: 'Document not found' }, 404)
    }

    // Get latest version for content preview
    const latestVersion = await prisma.documents.findFirst({
      where: { documentId: slug },
      orderBy: { id: 'desc' },
      select: { data: true }
    })

    // Extract text content from Y.js data (simplified extraction)
    let contentPreview = ''
    if (latestVersion?.data) {
      try {
        const dataStr = JSON.stringify(latestVersion.data)
        // Try to extract readable text from the serialized data
        // This is a simplified extraction - actual Y.js parsing would be more complex
        const textMatches = dataStr.match(/"text":"([^"]+)"/g)
        if (textMatches) {
          contentPreview = textMatches
            .map((m) => m.replace(/"text":"/, '').replace(/"$/, ''))
            .join(' ')
            .slice(0, 500)
        } else {
          contentPreview = dataStr.slice(0, 500)
        }
      } catch {
        contentPreview = '(Unable to parse content)'
      }
    } else {
      contentPreview = '(No content)'
    }

    // Get owner info
    let owner: { username: string | null; email: string | null } | null = null
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (doc.ownerId && supabaseUrl && supabaseKey) {
      try {
        const userRes = await fetch(
          `${supabaseUrl}/rest/v1/users?id=eq.${doc.ownerId}&select=username,email`,
          {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          }
        )
        const users = await userRes.json()
        if (Array.isArray(users) && users.length > 0) {
          owner = { username: users[0].username, email: users[0].email }
        }
      } catch (err) {
        console.error('Failed to fetch owner:', err)
      }
    }

    // Get workspace/channel info for deletion impact
    let deletionImpact = { workspace_id: null as string | null, channel_count: 0, message_count: 0 }

    if (supabaseUrl && supabaseKey) {
      try {
        const workspaceRes = await fetch(
          `${supabaseUrl}/rest/v1/workspaces?slug=eq.${slug}&select=id`,
          {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          }
        )
        const workspaces = await workspaceRes.json()

        if (Array.isArray(workspaces) && workspaces.length > 0) {
          const workspaceId = workspaces[0].id
          deletionImpact.workspace_id = workspaceId

          // Get channel count
          const channelsRes = await fetch(
            `${supabaseUrl}/rest/v1/channels?workspace_id=eq.${workspaceId}&select=id`,
            {
              headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
            }
          )
          const channels = await channelsRes.json()
          deletionImpact.channel_count = Array.isArray(channels) ? channels.length : 0

          // Get message count (approximate via channel IDs)
          if (Array.isArray(channels) && channels.length > 0) {
            const channelIds = channels.map((ch: { id: string }) => `"${ch.id}"`).join(',')
            const messagesRes = await fetch(
              `${supabaseUrl}/rest/v1/messages?channel_id=in.(${channelIds})&select=id`,
              {
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  Prefer: 'count=exact'
                }
              }
            )
            const contentRange = messagesRes.headers.get('content-range')
            if (contentRange) {
              const match = contentRange.match(/\/(\d+)$/)
              if (match) {
                deletionImpact.message_count = parseInt(match[1])
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch deletion impact:', err)
      }
    }

    return c.json({
      slug: doc.slug,
      title: doc.title,
      content_preview: contentPreview,
      version_count: doc._count.documents,
      created_at: doc.createdAt.toISOString(),
      updated_at: doc.updatedAt.toISOString(),
      owner,
      deletion_impact: deletionImpact
    })
  } catch (error) {
    console.error('Failed to get document preview:', error)
    return c.json({ error: 'Failed to fetch document preview' }, 500)
  }
}

/**
 * Bulk delete stale documents
 */
export async function bulkDeleteStaleDocuments(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const body = await c.req.json()
    const slugs: string[] = body.slugs || []
    const dryRun: boolean = body.dryRun ?? false

    if (slugs.length === 0) {
      return c.json({ error: 'No documents specified' }, 400)
    }

    if (slugs.length > 100) {
      return c.json({ error: 'Maximum 100 documents per batch' }, 400)
    }

    // Get document info for all slugs
    const documents = await prisma.documentMetadata.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true, title: true, documentId: true }
    })

    if (dryRun) {
      return c.json({
        dryRun: true,
        documentsFound: documents.length,
        documents: documents.map((d) => ({ slug: d.slug, title: d.title }))
      })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    let workspacesDeleted = 0
    const deleted: { slug: string; title: string | null }[] = []
    const failed: { slug: string; error: string }[] = []

    for (const doc of documents) {
      try {
        // Delete workspace in Supabase (CASCADE handles channels, messages)
        if (supabaseUrl && supabaseKey) {
          const deleteRes = await fetch(`${supabaseUrl}/rest/v1/workspaces?slug=eq.${doc.slug}`, {
            method: 'DELETE',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'return=minimal'
            }
          })
          if (deleteRes.ok) workspacesDeleted++
        }

        // Delete in Prisma
        await prisma.$transaction([
          prisma.documents.deleteMany({ where: { documentId: doc.documentId } }),
          prisma.documentMetadata.delete({ where: { id: doc.id } })
        ])

        deleted.push({ slug: doc.slug, title: doc.title })
      } catch (err) {
        failed.push({ slug: doc.slug, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return c.json({
      success: true,
      deleted: deleted.length,
      failed: failed.length,
      workspacesDeleted,
      deletedDocuments: deleted,
      failedDocuments: failed
    })
  } catch (error) {
    console.error('Failed to bulk delete documents:', error)
    return c.json({ error: 'Failed to delete documents' }, 500)
  }
}
