/**
 * Admin Dashboard Controller — Audit Operations
 *
 * Stale Documents, Failed Notifications, and Ghost Accounts. Handlers
 * validate input, call the stale/ghost/
 * notification-failure services for data access, and shape responses.
 * Read-only notification metrics and DLQ stay inline as thin RPC/Redis wrappers.
 */

import { Queue } from 'bullmq'

import { adminLogger } from '../../lib/logger'
import { createRedisConnection } from '../../lib/redis'
import { mediaStorageQuerySchema } from '../../schemas/admin.schema'
import type { AppContext } from '../../types/hono.types'
import { toBullMQConnection } from '../../types/redis.types'
import * as ghost from '../services/adminGhostAccounts.service'
import * as mediaStorage from '../services/adminMediaStorage.service'
import * as notificationFailures from '../services/adminNotificationFailures.service'
import * as stale from '../services/adminStaleDocuments.service'
import { getSupabaseClient } from '../utils/supabase'

// =============================================================================
// Stale Documents Audit
// =============================================================================

/**
 * Get stale documents summary statistics
 */
export async function getStaleDocumentsSummary(c: AppContext) {
  try {
    return c.json(await stale.getStaleSummary(c.get('prisma')))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get stale documents summary')
    return c.json({ error: 'Failed to fetch stale documents summary' }, 500)
  }
}

/**
 * List stale documents with pagination and filtering
 */
export async function listStaleDocuments(c: AppContext) {
  try {
    const result = await stale.listStale(c.get('prisma'), {
      page: parseInt(c.req.query('page') || '1'),
      limit: Math.min(parseInt(c.req.query('limit') || '20'), 100),
      minScore: parseInt(c.req.query('minScore') || '0'),
      sortBy: c.req.query('sortBy') || 'stale_score',
      sortDir: c.req.query('sortDir') === 'asc' ? 'asc' : 'desc'
    })
    return c.json(result)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to list stale documents')
    return c.json({ error: 'Failed to fetch stale documents' }, 500)
  }
}

/**
 * Get document content preview (first 500 chars)
 */
export async function getDocumentPreview(c: AppContext) {
  try {
    const slug = c.req.param('slug')
    if (!slug) return c.json({ error: 'Document slug required' }, 400)

    const preview = await stale.getDocumentPreview(c.get('prisma'), slug)
    if (!preview) return c.json({ error: 'Document not found' }, 404)
    return c.json(preview)
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

    const result = await stale.bulkDeleteStale(prisma, slugs, dryRun)
    if (!dryRun) stale.invalidateStaleCaches()
    return c.json(result)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to bulk delete documents')
    return c.json({ error: 'Failed to delete documents' }, 500)
  }
}

// =============================================================================
// Media Storage Audit
// =============================================================================

export async function getMediaStorageSummary(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  const result = await mediaStorage.getMediaStorageSummary(supabase)
  if (result.status === 'error') {
    adminLogger.error({ err: result.message }, 'Failed to get media storage summary')
    return c.json({ error: 'Failed to fetch media storage summary' }, 500)
  }

  return c.json(result.data)
}

export async function listMediaStorage(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  const query = mediaStorageQuerySchema.parse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    search: c.req.query('search'),
    sortBy: c.req.query('sortBy'),
    sortDir: c.req.query('sortDir'),
    scope: c.req.query('scope')
  })
  const result = await mediaStorage.listMediaStorage(supabase, query)

  if (result.status === 'error') {
    adminLogger.error({ err: result.message }, 'Failed to list media storage')
    const status = result.message.includes('Export exceeds') ? 400 : 500
    return c.json({ error: result.message }, status)
  }

  return c.json({
    summary: result.summary,
    data: result.data,
    pagination: result.pagination
  })
}

// =============================================================================
// Failed Notifications Audit
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
    const result = await notificationFailures.disableFailedSubscriptions(supabase, {
      minFailures: body.minFailures ?? 5,
      errorPattern: body.errorPattern ?? '%',
      subscriptionIds: body.subscriptionIds ?? null
    })
    if ('error' in result) {
      adminLogger.error({ err: result.error }, 'Failed to disable subscriptions')
      return c.json({ error: 'Failed to disable subscriptions' }, 500)
    }
    return c.json({ success: true, ...result.result })
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
  let redisConnection: ReturnType<typeof createRedisConnection> = null
  let pushDlq: Queue | null = null
  let emailDlq: Queue | null = null
  try {
    redisConnection = createRedisConnection({
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

    pushDlq = new Queue('push-notifications-dlq', { connection })
    emailDlq = new Queue('email-notifications-dlq', { connection })

    const [pushJobs, emailJobs] = await Promise.all([
      pushDlq.getJobs(['waiting', 'delayed'], 0, limit).catch(() => []),
      emailDlq.getJobs(['waiting', 'delayed'], 0, limit).catch(() => [])
    ])

    const [pushCount, emailCount] = await Promise.all([
      pushDlq.getJobCounts('waiting', 'delayed').catch(() => ({ waiting: 0, delayed: 0 })),
      emailDlq.getJobCounts('waiting', 'delayed').catch(() => ({ waiting: 0, delayed: 0 }))
    ])

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
  } finally {
    // Release the per-request BullMQ queues + connection even on the error
    // path; allSettled so one rejection can't skip the others.
    await Promise.allSettled([pushDlq?.close(), emailDlq?.close(), redisConnection?.quit()])
  }
}

// =============================================================================
// Ghost Accounts Audit
// =============================================================================

/**
 * List ghost accounts — detection via Supabase Admin API + public.users cross-ref
 */
export async function getGhostAccounts(c: AppContext) {
  try {
    const adminAuth = getSupabaseClient()
    if (!adminAuth) return c.json({ error: 'Supabase not configured' }, 500)

    const result = await ghost.listGhostAccounts(adminAuth, {
      minAgeDays: parseInt(c.req.query('minAgeDays') || '7'),
      ghostType: c.req.query('ghostType') || null,
      page: parseInt(c.req.query('page') || '1'),
      perPage: Math.min(parseInt(c.req.query('perPage') || '50'), 100)
    })
    return c.json(result)
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

    return c.json(await ghost.getGhostSummary(adminAuth))
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
    const result = await ghost.getGhostDeletionImpact(supabase, userId)
    if ('error' in result) {
      adminLogger.error({ err: result.error }, 'Failed to get deletion impact')
      return c.json({ error: 'Failed to fetch deletion impact' }, 500)
    }
    return c.json(result.impact)
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
    if (!userId) return c.json({ error: 'Missing user id' }, 400)

    const result = await ghost.deleteGhostAccount(adminAuth, userId)
    if (result.status === 'error') return c.json({ error: result.message }, 500)
    if (result.status === 'soft_delete') {
      return c.json({ success: true, strategy: 'soft_delete', reason: result.reason })
    }
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
    const results = await ghost.bulkDeleteGhostAccounts(adminAuth, userIds)
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
    const staleAnon = await ghost.fetchStaleAnonymous(adminAuth, minAgeDays)

    const batch = staleAnon.slice(0, 50)
    const results = { deleted: 0, failed: 0 }
    for (const user of batch) {
      const { error } = await adminAuth.auth.admin.deleteUser(user.id)
      if (error) results.failed++
      else results.deleted++
    }

    if (results.deleted > 0) ghost.invalidateGhostCaches()
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
