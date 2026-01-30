import { DEFAULT_PAGE_SIZE } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import type {
  Channel,
  ChannelStats,
  EmailStats,
  NotificationStats,
  PushStats,
  SupabaseStats,
  TableSize,
  User} from '@/types'
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
