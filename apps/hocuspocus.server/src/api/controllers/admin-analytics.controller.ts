/**
 * Admin Dashboard Controller — Analytics
 *
 * Thin handlers: validate input, call adminAnalytics.service, shape the
 * response. Pure RPC reads are registered through the `rpcRoute` table below;
 * handlers with enrichment or extra validation stay bespoke.
 */

import { adminLogger } from '../../lib/logger'
import type { AppContext } from '../../types/hono.types'
import * as analytics from '../services/adminAnalytics.service'
import { getSupabaseClient } from '../utils/supabase'

interface RpcRouteConfig {
  rpc: string
  args?: (c: AppContext) => Record<string, unknown>
  fallback?: unknown
  logMsg: string
  errMsg: string
}

/** Build a handler for a pure Supabase RPC read; variance is data, not control flow. */
function rpcRoute(config: RpcRouteConfig) {
  return async (c: AppContext) => {
    try {
      const supabase = getSupabaseClient()
      if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

      const { data, error } = await analytics.callRpc(supabase, config.rpc, config.args?.(c))
      if (error) {
        adminLogger.error({ err: error }, config.logMsg)
        return c.json({ error: config.errMsg }, 500)
      }
      return c.json('fallback' in config ? (data ?? config.fallback) : data)
    } catch (error) {
      adminLogger.error({ err: error }, config.logMsg)
      return c.json({ error: config.errMsg }, 500)
    }
  }
}

export const getViewsSummary = rpcRoute({
  rpc: 'get_document_views_summary',
  logMsg: 'Failed to get views summary',
  errMsg: 'Failed to fetch view statistics'
})

export const getViewsTrend = rpcRoute({
  rpc: 'get_document_views_trend',
  args: (c) => ({
    p_document_slug: c.req.query('slug') || null,
    p_days: Math.min(Math.max(parseInt(c.req.query('days') || '30'), 1), 90)
  }),
  fallback: [],
  logMsg: 'Failed to get views trend',
  errMsg: 'Failed to fetch trend data'
})

export const getRetentionMetrics = rpcRoute({
  rpc: 'get_retention_metrics',
  logMsg: 'Failed to get retention metrics',
  errMsg: 'Failed to fetch retention metrics'
})

export const getUserLifecycleSegments = rpcRoute({
  rpc: 'get_user_lifecycle_segments',
  logMsg: 'Failed to get user lifecycle segments',
  errMsg: 'Failed to fetch lifecycle segments'
})

export const getDauTrend = rpcRoute({
  rpc: 'get_dau_trend',
  args: (c) => ({ p_days: Math.min(Math.max(parseInt(c.req.query('days') || '30'), 1), 90) }),
  fallback: [],
  logMsg: 'Failed to get DAU trend',
  errMsg: 'Failed to fetch DAU trend'
})

export const getSignupsTrend = rpcRoute({
  rpc: 'get_signups_per_day',
  args: (c) => ({ p_days: Math.min(Math.max(parseInt(c.req.query('days') || '30'), 1), 90) }),
  fallback: [],
  logMsg: 'Failed to get signups trend',
  errMsg: 'Failed to fetch signups trend'
})

export const getActivityByHour = rpcRoute({
  rpc: 'get_activity_by_hour',
  args: (c) => ({ p_days: Math.min(Math.max(parseInt(c.req.query('days') || '7'), 1), 30) }),
  fallback: [],
  logMsg: 'Failed to get activity by hour',
  errMsg: 'Failed to fetch activity data'
})

export const getCommunicationStats = rpcRoute({
  rpc: 'get_communication_stats',
  args: (c) => ({ p_days: Math.min(Math.max(parseInt(c.req.query('days') || '7'), 1), 30) }),
  logMsg: 'Failed to get communication stats',
  errMsg: 'Failed to fetch communication stats'
})

export const getMessageTypeDistribution = rpcRoute({
  rpc: 'get_message_type_distribution',
  args: (c) => ({ p_days: Math.min(Math.max(parseInt(c.req.query('days') || '7'), 1), 30) }),
  fallback: [],
  logMsg: 'Failed to get message type distribution',
  errMsg: 'Failed to fetch message type distribution'
})

export const getNotificationReach = rpcRoute({
  rpc: 'get_notification_reach',
  logMsg: 'Failed to get notification reach',
  errMsg: 'Failed to fetch notification reach'
})

/**
 * Get single document view stats
 */
export async function getDocumentViewStats(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const slug = c.req.param('slug')
    if (!slug) return c.json({ error: 'Document slug required' }, 400)

    const { data, error } = await analytics.callRpc(supabase, 'get_document_view_stats', {
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

    const result = await analytics.getTopViewedDocuments(supabase, prisma, limit, days)
    if ('error' in result) {
      adminLogger.error({ err: result.error }, 'Failed to get top viewed documents')
      return c.json({ error: 'Failed to fetch top documents' }, 500)
    }
    return c.json(result.data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get top viewed documents')
    return c.json({ error: 'Failed to fetch top documents' }, 500)
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

    const result = await analytics.getBatchDocumentTrends(supabase, slugs, days)
    if ('error' in result) {
      adminLogger.error({ err: result.error }, 'Failed to get batch trends')
      return c.json({ error: 'Failed to fetch trend data' }, 500)
    }
    return c.json(result.data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get batch trends')
    return c.json({ error: 'Failed to fetch trend data' }, 500)
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

    const result = await analytics.getTopActiveDocuments(supabase, prisma, limit, days)
    if ('error' in result) {
      adminLogger.error({ err: result.error }, 'Failed to get top active documents')
      return c.json({ error: 'Failed to fetch top documents' }, 500)
    }
    return c.json(result.data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get top active documents')
    return c.json({ error: 'Failed to fetch top documents' }, 500)
  }
}
