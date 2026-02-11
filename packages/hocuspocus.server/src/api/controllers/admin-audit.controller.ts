/**
 * Admin Dashboard Controller — Audit Operations
 *
 * Stale Documents (Phase 13), Failed Notifications (Phase 17),
 * and Ghost Accounts (Phase 15) audit endpoints.
 */

import { TiptapTransformer } from '@hocuspocus/transformer'
import { Queue } from 'bullmq'
import * as Y from 'yjs'

import { adminLogger } from '../../lib/logger'
import { createRedisConnection } from '../../lib/redis'
import type { AppContext } from '../../types/hono.types'
import { toBullMQConnection } from '../../types/redis.types'
import { getSupabaseClient, supabaseRest } from '../utils/supabase'

// =============================================================================
// Shared Helpers
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

// =============================================================================
// Stale Documents Audit (Phase 13)
// =============================================================================

// In-memory cache for summary stats (5 minute TTL)
let staleSummaryCache: { data: unknown; expiresAt: number } | null = null
const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Stale Detection Scoring (Industry Standard — Multi-Signal)
 *
 * Combines edit activity AND view activity to determine staleness:
 * - views_30d = 0 AND days_inactive > 90 → Truly Abandoned (100)
 * - views_7d = 0 AND version_count <= 1 → Ghost Document (90)
 * - views_7d = 0 AND days_inactive > 30 → Declining Interest (70)
 * - views_7d < 3 AND days_inactive > 60 → Low Engagement (50)
 * - Otherwise if low edits but has views → Not Stale (0)
 */

function computeStaleScore(
  views7d: number,
  views30d: number,
  versionCount: number,
  daysInactive: number
): { score: number; reason: string } {
  if (views30d === 0 && daysInactive > 90) return { score: 100, reason: 'Truly Abandoned' }
  if (views7d === 0 && versionCount <= 1) return { score: 90, reason: 'Ghost Document' }
  if (views7d === 0 && daysInactive > 30) return { score: 70, reason: 'Declining Interest' }
  if (views7d < 3 && daysInactive > 60) return { score: 50, reason: 'Low Engagement' }
  return { score: 0, reason: '' }
}

/**
 * Fetch view stats from Supabase for a list of document slugs
 */
async function fetchViewStatsMap(
  slugs: string[]
): Promise<Map<string, { views_7d: number; views_30d: number; last_viewed_at?: string | null }>> {
  const map = new Map<
    string,
    { views_7d: number; views_30d: number; last_viewed_at?: string | null }
  >()
  if (slugs.length === 0) return map

  try {
    const quotedSlugs = slugs.map((s) => `"${s}"`).join(',')
    const res = await supabaseRest(
      `document_view_stats?document_slug=in.(${quotedSlugs})&select=document_slug,views_7d,views_30d,last_viewed_at`
    )
    if (!res) return map

    const viewStats = await res.json()
    if (Array.isArray(viewStats)) {
      viewStats.forEach(
        (v: {
          document_slug: string
          views_7d: number
          views_30d: number
          last_viewed_at?: string | null
        }) => {
          map.set(v.document_slug, {
            views_7d: v.views_7d || 0,
            views_30d: v.views_30d || 0,
            last_viewed_at: v.last_viewed_at || null
          })
        }
      )
    }
  } catch (err) {
    adminLogger.error({ err }, 'Failed to fetch view stats')
  }

  return map
}

/**
 * Fetch owner info for a list of user IDs from Supabase
 */
async function fetchOwnerMap(
  ownerIds: string[]
): Promise<
  Map<string, { username: string | null; email: string | null; avatar_url: string | null }>
> {
  const map = new Map<
    string,
    { username: string | null; email: string | null; avatar_url: string | null }
  >()
  if (ownerIds.length === 0) return map

  try {
    const quotedIds = ownerIds.map((id) => `"${id}"`).join(',')
    const res = await supabaseRest(`users?id=in.(${quotedIds})&select=id,username,email,avatar_url`)
    if (!res) return map

    const users = await res.json()
    if (Array.isArray(users)) {
      users.forEach((u: { id: string; username: string; email: string; avatar_url: string }) => {
        map.set(u.id, {
          username: u.username || null,
          email: u.email || null,
          avatar_url: u.avatar_url || null
        })
      })
    }
  } catch (err) {
    adminLogger.error({ err }, 'Failed to fetch owners')
  }

  return map
}

/**
 * Get stale documents summary statistics
 */
export async function getStaleDocumentsSummary(c: AppContext) {
  const prisma = c.get('prisma')

  // Check cache first
  if (staleSummaryCache && Date.now() < staleSummaryCache.expiresAt) {
    return c.json(staleSummaryCache.data)
  }

  try {
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

    // Fetch view stats from Supabase
    const viewStatsMap = await fetchViewStatsMap(docStats.map((d) => d.slug))

    // Calculate stale scores with view data
    let total_stale = 0
    let truly_abandoned = 0
    let ghost_document = 0
    let declining = 0
    let low_engagement = 0
    let recoverable_bytes = 0n

    for (const doc of docStats) {
      const views = viewStatsMap.get(doc.slug) || { views_7d: 0, views_30d: 0 }
      const { score } = computeStaleScore(
        views.views_7d,
        views.views_30d,
        Number(doc.version_count),
        doc.days_inactive
      )

      if (score > 0) {
        total_stale++
        recoverable_bytes += doc.total_storage
      }
      if (score === 100) truly_abandoned++
      else if (score === 90) ghost_document++
      else if (score === 70) declining++
      else if (score === 50) low_engagement++
    }

    const summary = {
      total_stale,
      truly_abandoned,
      ghost_document,
      declining,
      low_engagement,
      recoverable_bytes: Number(recoverable_bytes)
    }

    staleSummaryCache = { data: summary, expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS }
    return c.json(summary)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get stale documents summary')
    return c.json({ error: 'Failed to fetch stale documents summary' }, 500)
  }
}

/**
 * List stale documents with pagination and filtering
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

    // Step 2: Fetch view stats from Supabase
    const viewStatsMap = await fetchViewStatsMap(allDocs.map((d) => d.slug))

    // Step 3: Calculate stale scores
    const scoredDocs = allDocs.map((doc) => {
      const views = viewStatsMap.get(doc.slug) || {
        views_7d: 0,
        views_30d: 0,
        last_viewed_at: null
      }
      const versionCount = Number(doc.version_count)
      const { score, reason } = computeStaleScore(
        views.views_7d,
        views.views_30d,
        versionCount,
        doc.days_inactive
      )

      return {
        ...doc,
        version_count: versionCount,
        stale_score: score,
        stale_reason: reason,
        views_7d: views.views_7d,
        views_30d: views.views_30d,
        last_viewed_at: views.last_viewed_at ?? null
      }
    })

    // Step 4: Filter and sort
    const filteredDocs = scoredDocs.filter((d) => d.stale_score >= minScore && d.stale_score > 0)

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

    // Step 5: Fetch document binary data for structure parsing
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

    // Step 7: Enrich with owner info
    const ownerIds = [...new Set(results.filter((d) => d.owner_id).map((d) => d.owner_id!))]
    const ownerMap = await fetchOwnerMap(ownerIds)

    results.forEach((doc) => {
      if (doc.owner_id) {
        const user = ownerMap.get(doc.owner_id)
        if (user) {
          doc.owner_name = user.username || user.email?.split('@')[0] || null
          doc.owner_avatar_url = user.avatar_url || null
        }
      }
    })

    return c.json({
      data: results,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to list stale documents')
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
    if (!slug) return c.json({ error: 'Document slug required' }, 400)

    const doc = await prisma.documentMetadata.findUnique({
      where: { slug },
      include: { _count: { select: { documents: true } } }
    })

    if (!doc) return c.json({ error: 'Document not found' }, 404)

    // Get latest version for content preview
    const latestVersion = await prisma.documents.findFirst({
      where: { documentId: slug },
      orderBy: { id: 'desc' },
      select: { data: true }
    })

    let contentPreview = ''
    if (latestVersion?.data) {
      try {
        const dataStr = JSON.stringify(latestVersion.data)
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
    if (doc.ownerId) {
      const ownerMap = await fetchOwnerMap([doc.ownerId])
      const u = ownerMap.get(doc.ownerId)
      if (u) owner = { username: u.username, email: u.email }
    }

    // Fallback to email from Prisma if no owner found
    if (!owner && doc.email) {
      owner = { username: null, email: doc.email }
    }

    // Get workspace/channel info for deletion impact
    const deletionImpact = {
      workspace_id: null as string | null,
      channel_count: 0,
      message_count: 0
    }

    try {
      const workspaceRes = await supabaseRest(`workspaces?slug=eq.${slug}&select=id`)
      if (workspaceRes) {
        const workspaces = await workspaceRes.json()
        if (Array.isArray(workspaces) && workspaces.length > 0) {
          const workspaceId = workspaces[0].id
          deletionImpact.workspace_id = workspaceId

          const channelsRes = await supabaseRest(
            `channels?workspace_id=eq.${workspaceId}&select=id`
          )
          if (channelsRes) {
            const channels = await channelsRes.json()
            deletionImpact.channel_count = Array.isArray(channels) ? channels.length : 0

            if (Array.isArray(channels) && channels.length > 0) {
              const channelIds = channels.map((ch: { id: string }) => `"${ch.id}"`).join(',')
              const messagesRes = await supabaseRest(
                `messages?channel_id=in.(${channelIds})&select=id`,
                { headers: { Prefer: 'count=exact' } }
              )
              if (messagesRes) {
                const contentRange = messagesRes.headers.get('content-range')
                if (contentRange) {
                  const match = contentRange.match(/\/(\d+)$/)
                  if (match) deletionImpact.message_count = parseInt(match[1])
                }
              }
            }
          }
        }
      }
    } catch (err) {
      adminLogger.error({ err }, 'Failed to fetch deletion impact')
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
    adminLogger.error({ err: error }, 'Failed to get document preview')
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

    if (slugs.length === 0) return c.json({ error: 'No documents specified' }, 400)
    if (slugs.length > 100) return c.json({ error: 'Maximum 100 documents per batch' }, 400)

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

    let workspacesDeleted = 0
    const deleted: { slug: string; title: string | null }[] = []
    const failed: { slug: string; error: string }[] = []

    for (const doc of documents) {
      try {
        const deleteRes = await supabaseRest(`workspaces?slug=eq.${doc.slug}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        })
        if (deleteRes?.ok) workspacesDeleted++

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
    adminLogger.error({ err: error }, 'Failed to bulk delete documents')
    return c.json({ error: 'Failed to delete documents' }, 500)
  }
}

// =============================================================================
// Failed Notifications Audit (Phase 17)
// =============================================================================

/**
 * Get combined notification health score (push + email)
 */
export async function getNotificationHealth(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const { data, error } = await supabase.rpc('get_notification_health')

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get notification health')
      return c.json({ error: 'Failed to fetch notification health' }, 500)
    }

    return c.json(data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get notification health')
    return c.json({ error: 'Failed to fetch notification health' }, 500)
  }
}

/**
 * Get push failure breakdown by error category + platform
 */
export async function getPushFailureSummary(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const { data, error } = await supabase.rpc('get_push_failure_summary')

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get push failure summary')
      return c.json({ error: 'Failed to fetch push failure summary' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get push failure summary')
    return c.json({ error: 'Failed to fetch push failure summary' }, 500)
  }
}

/**
 * Get email failure + bounce breakdown
 */
export async function getEmailFailureSummary(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const { data, error } = await supabase.rpc('get_email_failure_summary')

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get email failure summary')
      return c.json({ error: 'Failed to fetch email failure summary' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get email failure summary')
    return c.json({ error: 'Failed to fetch email failure summary' }, 500)
  }
}

/**
 * Get detailed failed push subscriptions with user info
 */
export async function getFailedPushSubscriptions(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const minFailures = parseInt(c.req.query('minFailures') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500)

    const { data, error } = await supabase.rpc('get_failed_push_subscriptions', {
      p_min_failures: minFailures,
      p_limit: limit
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get failed push subscriptions')
      return c.json({ error: 'Failed to fetch failed subscriptions' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get failed push subscriptions')
    return c.json({ error: 'Failed to fetch failed subscriptions' }, 500)
  }
}

/**
 * Get email bounces list with user info
 */
export async function getEmailBounces(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const bounceType = c.req.query('bounceType') || null
    const days = parseInt(c.req.query('days') || '30')
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500)

    const { data, error } = await supabase.rpc('get_email_bounces', {
      p_bounce_type: bounceType,
      p_days: Math.min(days, 365),
      p_limit: limit
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get email bounces')
      return c.json({ error: 'Failed to fetch email bounces' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get email bounces')
    return c.json({ error: 'Failed to fetch email bounces' }, 500)
  }
}

/**
 * Bulk disable failed push subscriptions
 */
export async function disableFailedSubscriptions(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const body = await c.req.json()
    const minFailures = body.minFailures ?? 5
    const errorPattern = body.errorPattern ?? '%'
    const subscriptionIds = body.subscriptionIds ?? null

    const { data, error } = await supabase.rpc('disable_failed_subscriptions', {
      p_min_failures: minFailures,
      p_error_pattern: errorPattern,
      p_subscription_ids: subscriptionIds
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to disable subscriptions')
      return c.json({ error: 'Failed to disable subscriptions' }, 500)
    }

    const result = Array.isArray(data) ? data[0] : data
    return c.json({
      success: true,
      disabled_count: result?.disabled_count ?? 0,
      subscription_ids: result?.subscription_ids ?? []
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to disable subscriptions')
    return c.json({ error: 'Failed to disable subscriptions' }, 500)
  }
}

/**
 * Get Dead Letter Queue contents (push + email)
 * Queries BullMQ DLQ queues directly via Redis
 */
export async function getDeadLetterQueueContents(c: AppContext) {
  try {
    const redisConnection = createRedisConnection({
      maxRetriesPerRequest: null,
      enableReadyCheck: true
    })
    const connection = toBullMQConnection(redisConnection)

    if (!connection) {
      return c.json({
        push: { jobs: [], count: 0 },
        email: { jobs: [], count: 0 },
        error: 'Redis not configured'
      })
    }

    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)

    const pushDlq = new Queue('push-notifications-dlq', { connection })
    const emailDlq = new Queue('email-notifications-dlq', { connection })

    const [pushJobs, emailJobs] = await Promise.all([
      pushDlq.getJobs(['waiting', 'delayed'], 0, limit).catch(() => []),
      emailDlq.getJobs(['waiting', 'delayed'], 0, limit).catch(() => [])
    ])

    const [pushCount, emailCount] = await Promise.all([
      pushDlq.getJobCounts('waiting', 'delayed').catch(() => ({ waiting: 0, delayed: 0 })),
      emailDlq.getJobCounts('waiting', 'delayed').catch(() => ({ waiting: 0, delayed: 0 }))
    ])

    await pushDlq.close()
    await emailDlq.close()
    await redisConnection?.quit()

    return c.json({
      push: {
        jobs: pushJobs.map((j) => ({
          id: j.id,
          name: j.name,
          data: j.data,
          timestamp: j.timestamp,
          failedReason: j.failedReason
        })),
        count: (pushCount.waiting ?? 0) + (pushCount.delayed ?? 0)
      },
      email: {
        jobs: emailJobs.map((j) => ({
          id: j.id,
          name: j.name,
          data: j.data,
          timestamp: j.timestamp,
          failedReason: j.failedReason
        })),
        count: (emailCount.waiting ?? 0) + (emailCount.delayed ?? 0)
      }
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get DLQ contents')
    return c.json({ error: 'Failed to fetch DLQ contents' }, 500)
  }
}

// =============================================================================
// Ghost Accounts Audit (Phase 15)
// =============================================================================

/**
 * Paginate through ALL auth.users via Supabase Admin API.
 * listUsers caps at 1000 per page — this helper fetches every page.
 */
async function fetchAllAuthUsers(client: ReturnType<typeof getSupabaseClient>) {
  const allUsers: any[] = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await client!.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    allUsers.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }

  return allUsers
}

type GhostType =
  | 'unconfirmed_magic_link'
  | 'abandoned_sso'
  | 'stale_unconfirmed'
  | 'never_signed_in'
  | 'no_public_profile'
  | 'stale_anonymous'
  | 'orphaned_anonymous'

interface GhostAccount {
  id: string
  email: string | null
  provider: string
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  is_anonymous: boolean
  age_days: number
  ghost_type: GhostType
  has_public_profile: boolean
}

/** Classify a single auth.users row into a ghost category (or null if not a ghost) */
function classifyGhost(
  user: {
    id: string
    email?: string
    created_at: string
    email_confirmed_at?: string | null
    last_sign_in_at?: string | null
    is_anonymous?: boolean
    app_metadata?: Record<string, unknown>
  },
  hasPublicProfile: boolean,
  minAgeDays: number
): GhostType | null {
  const isAnon = user.is_anonymous || user.app_metadata?.provider === 'anonymous'
  const ageDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)

  // Anonymous users — separate lifecycle
  if (isAnon) {
    if (ageDays > 90) return 'orphaned_anonymous'
    if (ageDays > 30) return 'stale_anonymous'
    return null
  }

  if (ageDays < minAgeDays) return null

  const provider = (user.app_metadata?.provider as string) || 'email'

  if (!user.email_confirmed_at && provider === 'email') return 'unconfirmed_magic_link'
  if (!user.email_confirmed_at && provider === 'google' && !user.last_sign_in_at)
    return 'abandoned_sso'
  if (!user.email_confirmed_at && ageDays > 30) return 'stale_unconfirmed'
  if (!user.last_sign_in_at) return 'never_signed_in'
  if (!hasPublicProfile) return 'no_public_profile'

  return null
}

/**
 * List ghost accounts — detection via Supabase Admin API + public.users cross-ref
 */
export async function getGhostAccounts(c: AppContext) {
  try {
    const adminAuth = getSupabaseClient()
    if (!adminAuth) return c.json({ error: 'Supabase not configured' }, 500)

    const minAgeDays = parseInt(c.req.query('minAgeDays') || '7')
    const ghostTypeFilter = c.req.query('ghostType') || null
    const page = parseInt(c.req.query('page') || '1')
    const perPage = Math.min(parseInt(c.req.query('perPage') || '50'), 100)

    const allAuthUsers = await fetchAllAuthUsers(adminAuth)

    const { data: publicUsers } = await adminAuth.from('users').select('id')
    const publicUserIds = new Set(publicUsers?.map((u: { id: string }) => u.id) || [])

    const ghosts: GhostAccount[] = []
    for (const user of allAuthUsers) {
      const hasProfile = publicUserIds.has(user.id)
      const ghostType = classifyGhost(user, hasProfile, minAgeDays)
      if (!ghostType) continue
      if (ghostTypeFilter && ghostType !== ghostTypeFilter) continue

      ghosts.push({
        id: user.id,
        email: user.email || null,
        provider: (user.app_metadata?.provider as string) || 'unknown',
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        is_anonymous: user.is_anonymous || false,
        age_days: Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000),
        ghost_type: ghostType,
        has_public_profile: hasProfile
      })
    }

    ghosts.sort((a, b) => b.age_days - a.age_days)

    const start = (page - 1) * perPage
    const paged = ghosts.slice(start, start + perPage)

    return c.json({
      ghosts: paged,
      total: ghosts.length,
      page,
      perPage,
      totalPages: Math.ceil(ghosts.length / perPage)
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get ghost accounts')
    return c.json({ error: 'Failed to fetch ghost accounts' }, 500)
  }
}

/**
 * Ghost accounts summary — combines Admin API counts with public.users stats
 */
export async function getGhostAccountsSummary(c: AppContext) {
  try {
    const adminAuth = getSupabaseClient()
    if (!adminAuth) return c.json({ error: 'Supabase not configured' }, 500)

    const [allAuthUsers, publicResult, publicUsersResult] = await Promise.all([
      fetchAllAuthUsers(adminAuth),
      adminAuth.rpc('get_ghost_summary_public'),
      adminAuth.from('users').select('id')
    ])

    const publicUserIds = new Set(publicUsersResult.data?.map((u: { id: string }) => u.id) || [])

    const counts: Record<string, number> = {
      unconfirmed_magic_link: 0,
      abandoned_sso: 0,
      stale_unconfirmed: 0,
      never_signed_in: 0,
      no_public_profile: 0,
      stale_anonymous: 0,
      orphaned_anonymous: 0
    }
    let oldestDays = 0

    for (const user of allAuthUsers) {
      const hasProfile = publicUserIds.has(user.id)
      const ghostType = classifyGhost(user, hasProfile, 7)
      if (!ghostType) continue
      counts[ghostType]++
      const age = Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
      if (age > oldestDays) oldestDays = age
    }

    const totalGhosts = Object.values(counts).reduce((a, b) => a + b, 0)
    const publicSummary = Array.isArray(publicResult.data)
      ? publicResult.data[0]
      : publicResult.data

    return c.json({
      total_ghosts: totalGhosts,
      total_auth_users: allAuthUsers.length,
      oldest_ghost_days: oldestDays,
      by_type: counts,
      public_users: publicSummary || {
        total_public_users: 0,
        never_active_count: 0,
        soft_deleted_count: 0,
        active_count: 0
      }
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get ghost accounts summary')
    return c.json({ error: 'Failed to fetch summary' }, 500)
  }
}

/**
 * Get deletion impact for a single user (FK check)
 */
export async function getGhostDeletionImpact(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const userId = c.req.param('id')
    const { data, error } = await supabase.rpc('get_user_deletion_impact', { p_user_id: userId })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get deletion impact')
      return c.json({ error: 'Failed to fetch deletion impact' }, 500)
    }

    const impact = Array.isArray(data) ? data[0] : data
    return c.json(
      impact || {
        message_count: 0,
        channel_memberships: 0,
        push_subscriptions: 0,
        email_queue_items: 0,
        notifications_received: 0,
        has_blocking_messages: false
      }
    )
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get deletion impact')
    return c.json({ error: 'Failed to fetch deletion impact' }, 500)
  }
}

/**
 * Smart-delete a ghost account.
 * - has_blocking_messages = false → hard-delete via auth.admin.deleteUser (cascades)
 * - has_blocking_messages = true  → soft-delete (set deleted_at + ban auth user)
 */
export async function deleteGhostAccount(c: AppContext) {
  try {
    const adminAuth = getSupabaseClient()
    if (!adminAuth) return c.json({ error: 'Supabase not configured' }, 500)

    const userId = c.req.param('id')

    const { data: impact } = await adminAuth.rpc('get_user_deletion_impact', { p_user_id: userId })
    const row = Array.isArray(impact) ? impact[0] : impact
    const hasBlocking = row?.has_blocking_messages ?? false

    if (hasBlocking) {
      const [updateResult, banResult] = await Promise.all([
        adminAuth.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', userId),
        adminAuth.auth.admin.updateUserById(userId, { ban_duration: '876600h' })
      ])

      if (updateResult.error) return c.json({ error: updateResult.error.message }, 500)
      if (banResult.error)
        adminLogger.error({ err: banResult.error }, 'Failed to ban soft-deleted user')

      return c.json({
        success: true,
        strategy: 'soft_delete',
        reason: `User has ${row.message_count} messages — soft-deleted + banned to preserve history`
      })
    }

    const { error } = await adminAuth.auth.admin.deleteUser(userId)
    if (error) return c.json({ error: error.message }, 500)

    return c.json({ success: true, strategy: 'hard_delete' })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to delete ghost account')
    return c.json({ error: 'Failed to delete account' }, 500)
  }
}

/**
 * Bulk smart-delete ghost accounts (max 50)
 */
export async function bulkDeleteGhostAccounts(c: AppContext) {
  try {
    const adminAuth = getSupabaseClient()
    if (!adminAuth) return c.json({ error: 'Supabase not configured' }, 500)

    const { userIds } = await c.req.json()
    const results = { hard_deleted: 0, soft_deleted: 0, failed: 0, errors: [] as string[] }

    // Batch FK impact check: fetch all impacts in parallel
    const impactResults = await Promise.all(
      userIds.map(async (userId: string) => {
        try {
          const { data } = await adminAuth.rpc('get_user_deletion_impact', { p_user_id: userId })
          return { userId, impact: Array.isArray(data) ? data[0] : data }
        } catch {
          return { userId, impact: null }
        }
      })
    )

    const hardDeleteIds: string[] = []
    const softDeleteIds: string[] = []

    for (const { userId, impact } of impactResults) {
      if (!impact) {
        hardDeleteIds.push(userId)
        continue
      }
      if (impact.has_blocking_messages) softDeleteIds.push(userId)
      else hardDeleteIds.push(userId)
    }

    // Batch soft-delete + ban
    if (softDeleteIds.length > 0) {
      const now = new Date().toISOString()
      const { error: updateErr } = await adminAuth
        .from('users')
        .update({ deleted_at: now })
        .in('id', softDeleteIds)

      if (updateErr) {
        results.failed += softDeleteIds.length
        results.errors.push(`Soft-delete batch failed: ${updateErr.message}`)
      } else {
        await Promise.allSettled(
          softDeleteIds.map((id) =>
            adminAuth.auth.admin.updateUserById(id, { ban_duration: '876600h' })
          )
        )
        results.soft_deleted = softDeleteIds.length
      }
    }

    // Hard-delete (sequential — Supabase Admin API has no batch delete)
    for (const userId of hardDeleteIds) {
      try {
        const { error } = await adminAuth.auth.admin.deleteUser(userId)
        if (error) {
          results.failed++
          results.errors.push(`${userId}: ${error.message}`)
        } else {
          results.hard_deleted++
        }
      } catch (err) {
        results.failed++
        results.errors.push(`${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return c.json({ success: true, ...results })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to bulk delete ghost accounts')
    return c.json({ error: 'Failed to bulk delete' }, 500)
  }
}

/**
 * Resend confirmation email for unconfirmed ghost account
 */
export async function resendGhostConfirmation(c: AppContext) {
  try {
    const adminAuth = getSupabaseClient()
    if (!adminAuth) return c.json({ error: 'Supabase not configured' }, 500)

    const { email } = await c.req.json()

    const { error } = await adminAuth.auth.resend({ type: 'signup', email })
    if (error) return c.json({ error: error.message }, 500)

    return c.json({ success: true })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to resend confirmation')
    return c.json({ error: 'Failed to resend confirmation' }, 500)
  }
}

/**
 * Bulk cleanup stale anonymous sessions (> N days)
 */
export async function cleanupAnonymousSessions(c: AppContext) {
  try {
    const adminAuth = getSupabaseClient()
    if (!adminAuth) return c.json({ error: 'Supabase not configured' }, 500)

    const { minAgeDays = 90 } = await c.req.json()

    const allAuthUsers = await fetchAllAuthUsers(adminAuth)

    const staleAnon = allAuthUsers.filter((u) => {
      if (!u.is_anonymous) return false
      const ageDays = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000)
      return ageDays >= minAgeDays
    })

    const batch = staleAnon.slice(0, 50)
    const results = { deleted: 0, failed: 0 }

    for (const user of batch) {
      const { error } = await adminAuth.auth.admin.deleteUser(user.id)
      if (error) results.failed++
      else results.deleted++
    }

    return c.json({
      success: true,
      ...results,
      remaining: Math.max(0, staleAnon.length - 50)
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to cleanup anonymous sessions')
    return c.json({ error: 'Failed to cleanup' }, 500)
  }
}
