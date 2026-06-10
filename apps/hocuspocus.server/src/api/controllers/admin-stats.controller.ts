/**
 * Admin Dashboard Controller — Platform Stats & Directory
 *
 * System-wide user/channel/message/notification/push/email aggregates and the
 * user/channel directory listings. Everything here runs through the service_role
 * client so counts reflect the whole platform — the browser's anon-key client is
 * scoped by RLS (and email/push/email_queue are revoked from `authenticated`),
 * which is why these must not be computed client-side.
 */

import { adminLogger } from '../../lib/logger'
import type { AppContext } from '../../types/hono.types'
import { getSupabaseClient } from '../utils/supabase'

const CHANNEL_TYPES = ['PUBLIC', 'PRIVATE', 'BROADCAST', 'ARCHIVE', 'DIRECT', 'GROUP'] as const
const NOTIFICATION_TYPES = [
  'mention',
  'message',
  'reply',
  'reaction',
  'channel_event',
  'direct_message',
  'invitation',
  'system_alert'
] as const

const USERS_PAGE_SIZE = 20

type ServiceClient = NonNullable<ReturnType<typeof getSupabaseClient>>

/** Escape LIKE wildcards and drop PostgREST `.or()` delimiters from a search term. */
function sanitizeSearch(input: string): string {
  return input
    .trim()
    .slice(0, 100)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/[(),]/g, ' ')
}

export async function getPlatformStats(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStartIso = todayStart.toISOString()

    const head = { count: 'exact' as const, head: true }
    const usersTotal = supabase.from('users').select('id', head).is('deleted_at', null)
    const usersOnline = supabase
      .from('users')
      .select('id', head)
      .is('deleted_at', null)
      .eq('status', 'ONLINE')
    const usersNew = supabase
      .from('users')
      .select('id', head)
      .is('deleted_at', null)
      .gte('created_at', weekAgo)
    const channelsTotal = supabase.from('channels').select('id', head).is('deleted_at', null)
    const messagesTotal = supabase.from('messages').select('id', head).is('deleted_at', null)
    const messagesToday = supabase
      .from('messages')
      .select('id', head)
      .is('deleted_at', null)
      .gte('created_at', todayStartIso)
    const notificationsTotal = supabase.from('notifications').select('id', head)
    const notificationsUnread = supabase
      .from('notifications')
      .select('id', head)
      .is('readed_at', null)
    const channelsByType = CHANNEL_TYPES.map((type) =>
      supabase.from('channels').select('id', head).is('deleted_at', null).eq('type', type)
    )

    const results = await Promise.all([
      usersTotal,
      usersOnline,
      usersNew,
      channelsTotal,
      messagesTotal,
      messagesToday,
      notificationsTotal,
      notificationsUnread,
      ...channelsByType
    ])
    // Surface a failed count as a 500 instead of a silently-zeroed stat.
    const queryError = results.find((r) => r.error)?.error
    if (queryError) throw queryError

    const [
      total,
      online,
      newThisWeek,
      channelsTotalCount,
      messagesTotalCount,
      messagesTodayCount,
      notifTotalCount,
      notifUnreadCount,
      ...byTypeCounts
    ] = results

    const byType: Record<string, number> = {}
    CHANNEL_TYPES.forEach((type, i) => {
      const n = byTypeCounts[i]?.count ?? 0
      if (n > 0) byType[type] = n
    })

    return c.json({
      users: {
        total: total.count ?? 0,
        online: online.count ?? 0,
        newThisWeek: newThisWeek.count ?? 0
      },
      channels: { total: channelsTotalCount.count ?? 0, byType },
      messages: { total: messagesTotalCount.count ?? 0, today: messagesTodayCount.count ?? 0 },
      notifications: { total: notifTotalCount.count ?? 0, unread: notifUnreadCount.count ?? 0 }
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get platform stats')
    return c.json({ error: 'Failed to fetch platform statistics' }, 500)
  }
}

export async function getNotificationStatsAdmin(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const head = { count: 'exact' as const, head: true }
    const results = await Promise.all([
      supabase.from('notifications').select('id', head),
      supabase.from('notifications').select('id', head).is('readed_at', null),
      ...NOTIFICATION_TYPES.map((type) =>
        supabase.from('notifications').select('id', head).eq('type', type)
      )
    ])
    // Surface a failed count as a 500 instead of a silently-zeroed stat.
    const queryError = results.find((r) => r.error)?.error
    if (queryError) throw queryError

    const [totalRes, unreadRes, ...byTypeRes] = results

    const total = totalRes.count ?? 0
    const unread = unreadRes.count ?? 0
    const byType: Record<string, number> = {}
    NOTIFICATION_TYPES.forEach((type, i) => {
      const n = byTypeRes[i]?.count ?? 0
      if (n > 0) byType[type] = n
    })

    return c.json({
      total,
      unread,
      readRate: total > 0 ? Math.round(((total - unread) / total) * 100) : 0,
      byType
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get notification stats')
    return c.json({ error: 'Failed to fetch notification statistics' }, 500)
  }
}

export async function getEmailStatsAdmin(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const head = { count: 'exact' as const, head: true }
    const [pending, sent, failed] = await Promise.all([
      supabase.from('email_queue').select('id', head).eq('status', 'pending'),
      supabase.from('email_queue').select('id', head).eq('status', 'sent'),
      supabase.from('email_queue').select('id', head).eq('status', 'failed')
    ])
    if (pending.error || sent.error || failed.error) {
      throw pending.error || sent.error || failed.error
    }
    return c.json({
      pending: pending.count ?? 0,
      sent: sent.count ?? 0,
      failed: failed.count ?? 0
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get email stats')
    return c.json({ error: 'Failed to fetch email statistics' }, 500)
  }
}

export async function getPushStatsAdmin(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const head = { count: 'exact' as const, head: true }
    const [active, failed] = await Promise.all([
      supabase.from('push_subscriptions').select('id', head).eq('is_active', true),
      supabase.from('push_subscriptions').select('id', head).gt('failed_count', 0)
    ])
    if (active.error || failed.error) throw active.error || failed.error
    return c.json({ active: active.count ?? 0, failed: failed.count ?? 0 })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get push stats')
    return c.json({ error: 'Failed to fetch push statistics' }, 500)
  }
}

export async function getPushPipelineAdmin(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const { data, error } = await supabase.rpc('get_push_queue_stats')
    if (error || !data) {
      adminLogger.error({ err: error }, 'get_push_queue_stats failed')
      return c.json({ error: 'Failed to fetch push pipeline statistics' }, 500)
    }
    const d = data as {
      queue_length: number
      oldest_message_age_seconds: number
      active_subscriptions: number
      inactive_subscriptions: number
      failed_subscriptions: number
      consumer_status: string
      messages_processed: number
      last_push_sent: string | null
    }
    return c.json({
      triggerConfigured: true,
      queueDepth: d.queue_length,
      messagesProcessed: d.messages_processed,
      messagesFailed: 0,
      totalSubscriptions: d.active_subscriptions + d.inactive_subscriptions,
      activeSubscriptions: d.active_subscriptions,
      failedSubscriptions: d.failed_subscriptions,
      lastPushSent: d.last_push_sent,
      lastPushError: null,
      consumerStatus: d.consumer_status,
      oldestMessageAge: d.oldest_message_age_seconds
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get push pipeline stats')
    return c.json({ error: 'Failed to fetch push pipeline statistics' }, 500)
  }
}

/**
 * System-wide push_subscriptions (no credentials) for the analytics panel's
 * client-side aggregation; paginates past the 1000-row cap. Scaling cliff: ships
 * the whole table to the browser — move to a server-side group-by past ~10k rows.
 */
export async function getPushSubscriptionsRaw(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const rows = await fetchAllRows(supabase, 'push_subscriptions', {
      columns: 'platform, updated_at, created_at, is_active, failed_count, last_error',
      orderColumn: 'created_at'
    })
    return c.json(rows)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get push subscriptions')
    return c.json({ error: 'Failed to fetch push subscriptions' }, 500)
  }
}

// Directory listings — users.email is revoked from `authenticated`, so these
// must run through the service_role client, not the browser.
export async function listUsers(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const page = Math.max(parseInt(c.req.query('page') || '1'), 1)
    const search = c.req.query('search') || ''
    const sortBy = c.req.query('sortBy') || ''
    const sortDir = c.req.query('sortDir') === 'asc' ? 'asc' : 'desc'

    const sortFieldMap: Record<string, string> = {
      username: 'username',
      email: 'email',
      full_name: 'full_name',
      status: 'status',
      created_at: 'created_at',
      online_at: 'online_at'
    }
    const orderField = sortFieldMap[sortBy] || 'created_at'

    let query = supabase
      .from('users')
      .select(
        'id, username, email, full_name, avatar_url, avatar_updated_at, status, created_at, online_at',
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order(orderField, { ascending: sortDir === 'asc', nullsFirst: false })
      .range((page - 1) * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE - 1)

    if (search) {
      const s = sanitizeSearch(search)
      if (s) query = query.or(`username.ilike.%${s}%,email.ilike.%${s}%,full_name.ilike.%${s}%`)
    }

    const { data, count, error } = await query
    if (error) throw error

    return c.json({
      data: data ?? [],
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / USERS_PAGE_SIZE)
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to list users')
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
}

export async function listChannels(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const page = Math.max(parseInt(c.req.query('page') || '1'), 1)
    const search = c.req.query('search') || ''
    const sortBy = c.req.query('sortBy') || ''
    const sortDir = c.req.query('sortDir') === 'asc' ? 'asc' : 'desc'

    const sortFieldMap: Record<string, string> = {
      name: 'name',
      type: 'type',
      member_count: 'member_count',
      last_activity_at: 'last_activity_at',
      created_at: 'created_at'
    }
    const orderField = sortFieldMap[sortBy] || 'last_activity_at'

    let query = supabase
      .from('channels')
      .select(
        `id, workspace_id, name, type, member_count, last_activity_at, created_at,
         workspaces!inner(slug, name)`,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .eq('type', 'PUBLIC')
      .order(orderField, { ascending: sortDir === 'asc', nullsFirst: false })
      .range((page - 1) * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE - 1)

    if (search) {
      const s = sanitizeSearch(search)
      if (s) query = query.ilike('name', `%${s}%`)
    }

    const { data, count, error } = await query
    if (error) throw error

    const channels = (data ?? []).map((ch: Record<string, unknown>) => {
      const workspace = ch.workspaces as { slug: string; name: string | null } | null
      return {
        id: ch.id as string,
        workspace_id: (ch.workspace_id as string | null) ?? null,
        name: (ch.name as string | null) ?? null,
        type: ch.type as string,
        member_count: ch.member_count as number,
        last_activity_at: (ch.last_activity_at as string | null) ?? null,
        created_at: ch.created_at as string,
        document_slug: workspace?.slug ?? null,
        document_name: workspace?.name ?? null
      }
    })

    return c.json({
      data: channels,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / USERS_PAGE_SIZE)
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to list channels')
    return c.json({ error: 'Failed to fetch channels' }, 500)
  }
}

export async function getTableSizes(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  const tables = [
    'users',
    'channels',
    'messages',
    'notifications',
    'push_subscriptions',
    'email_queue'
  ]
  const head = { count: 'exact' as const, head: true }
  const results = await Promise.all(
    tables.map(async (table) => {
      try {
        const { count } = await supabase.from(table).select('id', head)
        return { table, rows: count ?? 0 }
      } catch {
        return { table, rows: 0 }
      }
    })
  )
  return c.json(results.sort((a, b) => b.rows - a.rows))
}

export async function getUserNotificationSubs(c: AppContext) {
  const supabase = getSupabaseClient()
  if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

  try {
    const result: Record<string, { web: boolean; ios: boolean; android: boolean; email: boolean }> =
      {}
    const ensure = (id: string) => {
      if (!result[id]) result[id] = { web: false, ios: false, android: false, email: false }
      return result[id]
    }

    // Read push_subscriptions directly via service_role (RLS-bypassed). Do NOT
    // call admin_get_user_notification_subs here — its in-body is_admin(auth.uid())
    // gate evaluates auth.uid()=NULL under service_role and returns zero rows.
    const pushRows = await fetchAllRows(supabase, 'push_subscriptions', {
      columns: 'user_id, platform, is_active',
      orderColumn: 'user_id'
    })
    pushRows.forEach((row) => {
      const r = row as { user_id: string | null; platform: string; is_active: boolean }
      if (!r.is_active || !r.user_id) return
      const entry = ensure(r.user_id)
      if (r.platform === 'web' || r.platform === 'ios' || r.platform === 'android') {
        entry[r.platform] = true
      }
    })

    const users = await fetchAllRows(supabase, 'users', {
      columns: 'id, profile_data',
      notNull: 'profile_data',
      orderColumn: 'id'
    })
    users.forEach((user) => {
      const u = user as { id: string; profile_data: Record<string, unknown> | null }
      const prefs = u.profile_data?.notification_preferences as Record<string, unknown> | undefined
      ensure(u.id).email = prefs?.email_enabled === true
    })

    return c.json(result)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get user notification subscriptions')
    return c.json({ error: 'Failed to fetch notification subscriptions' }, 500)
  }
}

const REST_PAGE = 1000

/** Page through a table past the PostgREST max-rows cap (service_role, all rows). */
async function fetchAllRows(
  supabase: ServiceClient,
  table: string,
  opts: { columns: string; orderColumn: string; notNull?: string }
): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = []
  for (let from = 0; ; from += REST_PAGE) {
    let q = supabase.from(table).select(opts.columns).order(opts.orderColumn, { ascending: true })
    if (opts.notNull) q = q.not(opts.notNull, 'is', null)
    const { data, error } = await q.range(from, from + REST_PAGE - 1)
    if (error) throw error
    const rows = (data as unknown as Array<Record<string, unknown>> | null) ?? []
    all.push(...rows)
    if (rows.length < REST_PAGE) break
  }
  return all
}
