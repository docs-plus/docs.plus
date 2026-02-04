import { DEFAULT_PAGE_SIZE } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import type {
  Channel,
  ChannelStats,
  EmailStats,
  NotificationStats,
  PushPipelineStats,
  PushStats,
  PushSubscriptionDetail,
  SupabaseStats,
  TableSize,
  User
} from '@/types'
import { sanitizeSearchInput } from '@/utils/sanitize'

const PAGE_SIZE = DEFAULT_PAGE_SIZE

/**
 * Fetch paginated users list with optional sorting
 */
export async function fetchUsers(
  page: number,
  search: string,
  sortBy?: string,
  sortDir?: 'asc' | 'desc'
) {
  // Map frontend keys to database columns
  const sortFieldMap: Record<string, string> = {
    username: 'username',
    email: 'email',
    full_name: 'full_name',
    status: 'status',
    created_at: 'created_at',
    online_at: 'online_at'
  }
  const orderField = sortFieldMap[sortBy || ''] || 'created_at'
  const ascending = sortDir === 'asc'

  let query = supabase
    .from('users')
    .select(
      'id, username, email, full_name, avatar_url, avatar_updated_at, status, created_at, online_at',
      {
        count: 'exact'
      }
    )
    .is('deleted_at', null)
    .order(orderField, { ascending, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (search) {
    const sanitized = sanitizeSearchInput(search)
    if (sanitized) {
      query = query.or(
        `username.ilike.%${sanitized}%,email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`
      )
    }
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    data: (data || []) as User[],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE)
  }
}

/**
 * Fetch paginated channels list with sorting, search, and document info
 */
export async function fetchChannels(
  page: number,
  sortBy?: string,
  sortDir?: 'asc' | 'desc',
  search?: string
) {
  // Map frontend keys to database columns
  const sortFieldMap: Record<string, string> = {
    name: 'name',
    type: 'type',
    member_count: 'member_count',
    last_activity_at: 'last_activity_at',
    created_at: 'created_at'
  }
  const orderField = sortFieldMap[sortBy || ''] || 'last_activity_at'
  const ascending = sortDir === 'asc'

  // Fetch only PUBLIC channels with workspace info (workspace has slug = document slug)
  let query = supabase
    .from('channels')
    .select(
      `id, workspace_id, name, type, member_count, last_activity_at, created_at,
       workspaces!inner(slug, name)`,
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .eq('type', 'PUBLIC')
    .order(orderField, { ascending, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  // Add search filter (only search by name since type is always PUBLIC)
  if (search) {
    const sanitized = sanitizeSearchInput(search)
    if (sanitized) {
      query = query.ilike('name', `%${sanitized}%`)
    }
  }

  const { data, count, error } = await query
  if (error) throw error

  // Map workspace data to document info
  const channels: Channel[] = (data || []).map((ch: Record<string, unknown>) => {
    const workspace = ch.workspaces as { slug: string; name: string | null } | null
    return {
      id: ch.id as string,
      workspace_id: ch.workspace_id as string | null,
      name: ch.name as string | null,
      type: ch.type as string,
      member_count: ch.member_count as number,
      last_activity_at: ch.last_activity_at as string | null,
      created_at: ch.created_at as string,
      document_slug: workspace?.slug || null,
      document_name: workspace?.name || null
    }
  })

  return {
    data: channels,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE)
  }
}

/**
 * Fetch channel statistics (PUBLIC channels only)
 */
export async function fetchChannelStats(): Promise<ChannelStats> {
  const { count, error } = await supabase
    .from('channels')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('type', 'PUBLIC')

  if (error) throw error

  return {
    total: count || 0,
    byType: { PUBLIC: count || 0 }
  }
}

/**
 * Fetch notification statistics
 */
export async function fetchNotificationStats(): Promise<NotificationStats> {
  const [totalResult, unreadResult, byTypeResult] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('readed_at', null),
    supabase.from('notifications').select('type')
  ])

  const total = totalResult.count || 0
  const unread = unreadResult.count || 0
  const readRate = total > 0 ? Math.round(((total - unread) / total) * 100) : 0

  const byType: Record<string, number> = {}
  byTypeResult.data?.forEach((n) => {
    byType[n.type] = (byType[n.type] || 0) + 1
  })

  return { total, unread, readRate, byType }
}

/**
 * Fetch push notification statistics
 */
export async function fetchPushStats(): Promise<PushStats> {
  const [activeResult, failedResult] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .gt('failed_count', 0)
  ])

  return {
    active: activeResult.count || 0,
    failed: failedResult.count || 0
  }
}

/**
 * Fetch email queue statistics
 */
export async function fetchEmailStats(): Promise<EmailStats> {
  const [pendingResult, sentResult, failedResult] = await Promise.all([
    supabase
      .from('email_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed')
  ])

  return {
    pending: pendingResult.count || 0,
    sent: sentResult.count || 0,
    failed: failedResult.count || 0
  }
}

/**
 * Fetch all Supabase stats for dashboard
 */
export async function fetchSupabaseStats(): Promise<SupabaseStats> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  // Create a new date for todayStart to avoid mutating `now`
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const [
    usersResult,
    onlineUsersResult,
    newUsersResult,
    channelsResult,
    messagesResult,
    messagesTodayResult,
    notificationsResult,
    unreadNotificationsResult
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'ONLINE'),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString()),
    supabase.from('channels').select('id, type', { count: 'exact' }).is('deleted_at', null),
    supabase.from('messages').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', todayStart.toISOString()),
    supabase.from('notifications').select('id', { count: 'exact', head: true }),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('readed_at', null)
  ])

  const channelsByType: Record<string, number> = {}
  if (channelsResult.data) {
    channelsResult.data.forEach((ch) => {
      channelsByType[ch.type] = (channelsByType[ch.type] || 0) + 1
    })
  }

  return {
    users: {
      total: usersResult.count || 0,
      online: onlineUsersResult.count || 0,
      newThisWeek: newUsersResult.count || 0
    },
    channels: {
      total: channelsResult.count || 0,
      byType: channelsByType
    },
    messages: {
      total: messagesResult.count || 0,
      today: messagesTodayResult.count || 0
    },
    notifications: {
      total: notificationsResult.count || 0,
      unread: unreadNotificationsResult.count || 0
    }
  }
}

/**
 * Fetch table row counts for system page (parallel fetching for performance)
 */
export async function fetchTableSizes(): Promise<TableSize[]> {
  const tables = [
    'users',
    'channels',
    'messages',
    'notifications',
    'push_subscriptions',
    'email_queue'
  ]

  const results = await Promise.all(
    tables.map(async (table) => {
      try {
        const { count } = await supabase.from(table).select('id', { count: 'exact', head: true })
        return { table, rows: count || 0 }
      } catch {
        return { table, rows: 0 }
      }
    })
  )

  return results.sort((a, b) => b.rows - a.rows)
}

/**
 * Check Supabase database health
 */
export async function checkDatabaseHealth(): Promise<{ status: string; latency: number }> {
  const start = Date.now()
  try {
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true })
    return {
      status: error ? 'degraded' : 'healthy',
      latency: Date.now() - start
    }
  } catch {
    return { status: 'down', latency: 0 }
  }
}

// =============================================================================
// Push Notification Debugging Functions
// =============================================================================

/**
 * Fetch push pipeline stats for admin debugging
 * Uses pgmq architecture with get_push_queue_stats() RPC
 */
export async function fetchPushPipelineStats(): Promise<PushPipelineStats> {
  // Use the get_push_queue_stats RPC (pgmq version)
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_push_queue_stats')

  if (!rpcError && rpcData) {
    // RPC returns: queue_length, oldest_message_age_seconds, active_subscriptions,
    // inactive_subscriptions, failed_subscriptions, consumer_status
    const data = rpcData as {
      queue_length: number
      oldest_message_age_seconds: number
      active_subscriptions: number
      inactive_subscriptions: number
      failed_subscriptions: number
      consumer_status: 'idle' | 'healthy' | 'backlog' | 'critical'
    }
    return {
      triggerConfigured: true, // pgmq consumer is always configured
      queueDepth: data.queue_length,
      messagesProcessed: 0, // Backend tracks this
      messagesFailed: 0,
      totalSubscriptions: data.active_subscriptions + data.inactive_subscriptions,
      activeSubscriptions: data.active_subscriptions,
      failedSubscriptions: data.failed_subscriptions,
      lastPushSent: null, // Would need separate tracking
      lastPushError: null,
      // Extra fields for enhanced display
      consumerStatus: data.consumer_status,
      oldestMessageAge: data.oldest_message_age_seconds
    }
  }

  // Fallback: Query tables directly if RPC fails
  console.warn('get_push_queue_stats RPC failed, using fallback:', rpcError?.message)
  const [activeResult, failedResult, totalResult] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .gt('failed_count', 0),
    supabase.from('push_subscriptions').select('id', { count: 'exact', head: true })
  ])

  return {
    triggerConfigured: true,
    queueDepth: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    totalSubscriptions: totalResult.count || 0,
    activeSubscriptions: activeResult.count || 0,
    failedSubscriptions: failedResult.count || 0,
    lastPushSent: null,
    lastPushError: null,
    consumerStatus: 'idle',
    oldestMessageAge: 0
  }
}

/**
 * Fetch failed push subscriptions with details
 */
export async function fetchFailedPushSubscriptions(limit = 10): Promise<PushSubscriptionDetail[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select(
      `
      id,
      user_id,
      device_name,
      platform,
      is_active,
      failed_count,
      last_error,
      last_used_at,
      created_at,
      users!inner(username)
    `
    )
    .gt('failed_count', 0)
    .order('failed_count', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch failed push subscriptions:', error)
    return []
  }

  return (data || []).map((sub: Record<string, unknown>) => ({
    id: sub.id as string,
    user_id: sub.user_id as string,
    username: (sub.users as { username: string | null } | null)?.username || null,
    device_name: sub.device_name as string | null,
    platform: sub.platform as string,
    is_active: sub.is_active as boolean,
    failed_count: sub.failed_count as number,
    last_error: sub.last_error as string | null,
    last_used_at: sub.last_used_at as string | null,
    created_at: sub.created_at as string
  }))
}

/**
 * Fetch recent push subscriptions activity
 */
export async function fetchRecentPushActivity(limit = 10): Promise<PushSubscriptionDetail[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select(
      `
      id,
      user_id,
      device_name,
      platform,
      is_active,
      failed_count,
      last_error,
      last_used_at,
      created_at,
      users!inner(username)
    `
    )
    .eq('is_active', true)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch recent push activity:', error)
    return []
  }

  return (data || []).map((sub: Record<string, unknown>) => ({
    id: sub.id as string,
    user_id: sub.user_id as string,
    username: (sub.users as { username: string | null } | null)?.username || null,
    device_name: sub.device_name as string | null,
    platform: sub.platform as string,
    is_active: sub.is_active as boolean,
    failed_count: sub.failed_count as number,
    last_error: sub.last_error as string | null,
    last_used_at: sub.last_used_at as string | null,
    created_at: sub.created_at as string
  }))
}

// =============================================================================
// User Notification Subscriptions (for Users page)
// =============================================================================

export interface UserNotificationSubs {
  web: boolean
  ios: boolean
  android: boolean
  email: boolean
}

/**
 * Fetch notification subscriptions for all users (batch)
 * Returns a map of user_id -> subscription platforms
 */
export async function fetchUserNotificationSubscriptions(): Promise<
  Record<string, UserNotificationSubs>
> {
  // Fetch push subscriptions (active only)
  const { data: pushSubs, error: pushError } = await supabase
    .from('push_subscriptions')
    .select('user_id, platform')
    .eq('is_active', true)

  if (pushError) {
    console.error('Failed to fetch push subscriptions:', pushError)
  }

  // Fetch email preferences from users table
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, profile_data')
    .not('profile_data', 'is', null)

  if (usersError) {
    console.error('Failed to fetch user email preferences:', usersError)
  }

  // Build result map
  const result: Record<string, UserNotificationSubs> = {}

  // Process push subscriptions
  ;(pushSubs || []).forEach((sub) => {
    const userId = sub.user_id
    if (!result[userId]) {
      result[userId] = { web: false, ios: false, android: false, email: false }
    }
    const platform = sub.platform as 'web' | 'ios' | 'android'
    if (platform === 'web' || platform === 'ios' || platform === 'android') {
      result[userId][platform] = true
    }
  })

  // Process email preferences
  ;(users || []).forEach((user) => {
    const userId = user.id
    if (!result[userId]) {
      result[userId] = { web: false, ios: false, android: false, email: false }
    }
    // Check if email notifications are enabled in profile_data
    const profileData = user.profile_data as Record<string, unknown> | null
    const notifPrefs = profileData?.notification_preferences as Record<string, unknown> | undefined
    result[userId].email = notifPrefs?.email_enabled === true
  })

  return result
}

// =============================================================================
// Push Subscription Analytics (v6.3.0)
// =============================================================================

import type { PlatformTrendPoint, PushSubscriptionAnalytics } from '@/types'

/**
 * Fetch comprehensive push subscription analytics
 * Single efficient query with all metrics
 */
export async function fetchPushSubscriptionAnalytics(): Promise<PushSubscriptionAnalytics> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Fetch all subscriptions with needed fields
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('platform, updated_at, created_at, is_active, failed_count, last_error')

  if (error) {
    console.error('Failed to fetch push analytics:', error)
    return getEmptyAnalytics()
  }

  const allSubs = subs || []
  const activeSubs = allSubs.filter((s) => s.is_active)

  // Platform breakdown
  const platforms = { web: 0, ios: 0, android: 0, desktop: 0, total: activeSubs.length }
  activeSubs.forEach((s) => {
    const p = s.platform as keyof typeof platforms
    if (p in platforms) platforms[p]++
  })

  // Subscription health (based on updated_at)
  let fresh = 0,
    ok = 0,
    stale = 0,
    totalAgeDays = 0
  activeSubs.forEach((s) => {
    const updatedAt = new Date(s.updated_at)
    const ageDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    totalAgeDays += ageDays
    if (ageDays < 7) fresh++
    else if (ageDays <= 30) ok++
    else stale++
  })
  const avgAgeDays = activeSubs.length > 0 ? Math.round(totalAgeDays / activeSubs.length) : 0

  // Lifecycle
  const newThisWeek = allSubs.filter((s) => s.is_active && new Date(s.created_at) >= weekAgo).length
  const churnedThisWeek = allSubs.filter(
    (s) => !s.is_active && new Date(s.updated_at) >= weekAgo
  ).length

  // Errors (parse last_error for common patterns)
  const errors: Record<string, number> = {}
  let totalErrors = 0
  allSubs
    .filter((s) => s.failed_count > 0 && s.last_error)
    .forEach((s) => {
      totalErrors++
      // Extract error type from last_error
      const errorType = categorizeError(s.last_error || '')
      errors[errorType] = (errors[errorType] || 0) + 1
    })

  return {
    platforms,
    health: { fresh, ok, stale, avgAgeDays },
    lifecycle: { newThisWeek, churnedThisWeek, total: allSubs.length },
    errors: { total: totalErrors, byType: errors }
  }
}

/**
 * Categorize error message into standard error codes
 */
function categorizeError(errorMsg: string): string {
  const lower = errorMsg.toLowerCase()
  if (lower.includes('expired') || lower.includes('410')) return 'EXPIRED'
  if (lower.includes('denied') || lower.includes('permission')) return 'PERMISSION_DENIED'
  if (lower.includes('not found') || lower.includes('404')) return 'NOT_FOUND'
  if (lower.includes('unauthorized') || lower.includes('401')) return 'UNAUTHORIZED'
  if (lower.includes('timeout') || lower.includes('timed out')) return 'TIMEOUT'
  if (lower.includes('network') || lower.includes('connection')) return 'NETWORK_ERROR'
  return 'OTHER'
}

function getEmptyAnalytics(): PushSubscriptionAnalytics {
  return {
    platforms: { web: 0, ios: 0, android: 0, desktop: 0, total: 0 },
    health: { fresh: 0, ok: 0, stale: 0, avgAgeDays: 0 },
    lifecycle: { newThisWeek: 0, churnedThisWeek: 0, total: 0 },
    errors: { total: 0, byType: {} }
  }
}

/**
 * Fetch platform subscription trend over time (last 30 days)
 */
export async function fetchPlatformTrend(days = 30): Promise<PlatformTrendPoint[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('platform, created_at')
    .eq('is_active', true)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch platform trend:', error)
    return []
  }

  // Group by date and platform
  const byDate: Record<string, { web: number; ios: number; android: number }> = {}
  ;(data || []).forEach((s) => {
    const date = s.created_at.split('T')[0]
    if (!byDate[date]) byDate[date] = { web: 0, ios: 0, android: 0 }
    const platform = s.platform as 'web' | 'ios' | 'android'
    if (platform in byDate[date]) byDate[date][platform]++
  })

  // Convert to cumulative trend
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))
}
