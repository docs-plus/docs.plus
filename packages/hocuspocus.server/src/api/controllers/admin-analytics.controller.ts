/**
 * Admin Dashboard Controller — Analytics
 *
 * Document view analytics and user retention metrics.
 * All endpoints delegate to Supabase RPCs and optionally
 * enrich results with Prisma data (titles, etc.).
 */

import { adminLogger } from '../../lib/logger'
import type { AppContext } from '../../types/hono.types'
import { getSupabaseClient } from '../utils/supabase'

// =============================================================================
// Document View Analytics
// =============================================================================

/**
 * Get document views summary (overall stats)
 */
export async function getViewsSummary(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const { data, error } = await supabase.rpc('get_document_views_summary')

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get views summary')
      return c.json({ error: 'Failed to fetch view statistics' }, 500)
    }

    return c.json(data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get views summary')
    return c.json({ error: 'Failed to fetch view statistics' }, 500)
  }
}

/**
 * Get top viewed documents (enriched with Prisma titles)
 */
export async function getTopViewedDocuments(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const limit = parseInt(c.req.query('limit') || '10')
    const days = parseInt(c.req.query('days') || '7')

    const { data, error } = await supabase.rpc('get_top_viewed_documents', {
      p_limit: Math.min(limit, 50),
      p_days: Math.min(days, 90)
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get top viewed documents')
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
    adminLogger.error({ err: error }, 'Failed to get top viewed documents')
    return c.json({ error: 'Failed to fetch top documents' }, 500)
  }
}

/**
 * Get document views trend (daily data for charts)
 */
export async function getViewsTrend(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const slug = c.req.query('slug') || null
    const days = parseInt(c.req.query('days') || '30')

    const { data, error } = await supabase.rpc('get_document_views_trend', {
      p_document_slug: slug,
      p_days: Math.min(days, 90)
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get views trend')
      return c.json({ error: 'Failed to fetch trend data' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get views trend')
    return c.json({ error: 'Failed to fetch trend data' }, 500)
  }
}

/**
 * Get batch document view trends (for sparklines in table)
 */
export async function getBatchDocumentTrends(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const slugsParam = c.req.query('slugs') || ''
    const days = parseInt(c.req.query('days') || '7')
    const slugs = slugsParam.split(',').filter(Boolean)

    if (slugs.length === 0) return c.json({})

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
      adminLogger.error({ err: error }, 'Failed to get batch trends')
      return c.json({ error: 'Failed to fetch trend data' }, 500)
    }

    // Group by slug and fill gaps with zeros
    const trendsBySlug: Record<string, number[]> = {}
    slugs.forEach((slug) => {
      trendsBySlug[slug] = []
    })

    const dateMap: Record<string, Record<string, number>> = {}
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      dateMap[dateStr] = {}
      slugs.forEach((slug) => {
        dateMap[dateStr][slug] = 0
      })
    }

    ;(data || []).forEach((row: { document_slug: string; view_date: string; views: number }) => {
      const dateStr =
        typeof row.view_date === 'string'
          ? row.view_date
          : new Date(row.view_date).toISOString().split('T')[0]
      if (dateMap[dateStr]) {
        dateMap[dateStr][row.document_slug] = row.views
      }
    })

    const sortedDates = Object.keys(dateMap).sort()
    slugs.forEach((slug) => {
      trendsBySlug[slug] = sortedDates.map((date) => dateMap[date][slug] || 0)
    })

    return c.json(trendsBySlug)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get batch trends')
    return c.json({ error: 'Failed to fetch trend data' }, 500)
  }
}

/**
 * Get single document view stats
 */
export async function getDocumentViewStats(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const slug = c.req.param('slug')
    if (!slug) return c.json({ error: 'Document slug required' }, 400)

    const { data, error } = await supabase.rpc('get_document_view_stats', {
      p_document_slug: slug
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get document view stats')
      return c.json({ error: 'Failed to fetch document stats' }, 500)
    }

    return c.json(data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get document view stats')
    return c.json({ error: 'Failed to fetch document stats' }, 500)
  }
}

// =============================================================================
// User Retention Analytics (Phase 8)
// =============================================================================

/**
 * Get retention metrics (DAU/WAU/MAU)
 */
export async function getRetentionMetrics(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const { data, error } = await supabase.rpc('get_retention_metrics')

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get retention metrics')
      return c.json({ error: 'Failed to fetch retention metrics' }, 500)
    }

    return c.json(data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get retention metrics')
    return c.json({ error: 'Failed to fetch retention metrics' }, 500)
  }
}

/**
 * Get user lifecycle segments
 */
export async function getUserLifecycleSegments(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const { data, error } = await supabase.rpc('get_user_lifecycle_segments')

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get user lifecycle segments')
      return c.json({ error: 'Failed to fetch lifecycle segments' }, 500)
    }

    return c.json(data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get user lifecycle segments')
    return c.json({ error: 'Failed to fetch lifecycle segments' }, 500)
  }
}

/**
 * Get DAU trend over time
 */
export async function getDauTrend(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const days = parseInt(c.req.query('days') || '30')

    const { data, error } = await supabase.rpc('get_dau_trend', {
      p_days: Math.min(days, 90)
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get DAU trend')
      return c.json({ error: 'Failed to fetch DAU trend' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get DAU trend')
    return c.json({ error: 'Failed to fetch DAU trend' }, 500)
  }
}

/**
 * Get activity by hour (for heatmap)
 */
export async function getActivityByHour(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const days = parseInt(c.req.query('days') || '7')

    const { data, error } = await supabase.rpc('get_activity_by_hour', {
      p_days: Math.min(days, 30)
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get activity by hour')
      return c.json({ error: 'Failed to fetch activity data' }, 500)
    }

    return c.json(data || [])
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get activity by hour')
    return c.json({ error: 'Failed to fetch activity data' }, 500)
  }
}

/**
 * Get top active documents (enriched with Prisma titles)
 */
export async function getTopActiveDocuments(c: AppContext) {
  const prisma = c.get('prisma')
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const limit = parseInt(c.req.query('limit') || '5')
    const days = parseInt(c.req.query('days') || '7')

    const { data, error } = await supabase.rpc('get_top_active_documents', {
      p_limit: Math.min(limit, 20),
      p_days: Math.min(days, 30)
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get top active documents')
      return c.json({ error: 'Failed to fetch top documents' }, 500)
    }

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
    adminLogger.error({ err: error }, 'Failed to get top active documents')
    return c.json({ error: 'Failed to fetch top documents' }, 500)
  }
}

/**
 * Get communication stats
 */
export async function getCommunicationStats(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const days = parseInt(c.req.query('days') || '7')

    const { data, error } = await supabase.rpc('get_communication_stats', {
      p_days: Math.min(days, 30)
    })

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get communication stats')
      return c.json({ error: 'Failed to fetch communication stats' }, 500)
    }

    return c.json(data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get communication stats')
    return c.json({ error: 'Failed to fetch communication stats' }, 500)
  }
}

/**
 * Get notification reach
 */
export async function getNotificationReach(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const { data, error } = await supabase.rpc('get_notification_reach')

    if (error) {
      adminLogger.error({ err: error }, 'Failed to get notification reach')
      return c.json({ error: 'Failed to fetch notification reach' }, 500)
    }

    return c.json(data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get notification reach')
    return c.json({ error: 'Failed to fetch notification reach' }, 500)
  }
}
