import { API_URL } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import type {
  AuditFailedSubscription,
  Channel,
  DashboardDocumentStats,
  DauTrendPoint,
  DeletionImpact,
  DisableResult,
  DLQContents,
  Document,
  DocumentStats,
  EmailBounce,
  EmailFailureSummary,
  EmailGatewayHealth,
  EmailStats,
  GhostAccountsResponse,
  GhostBulkDeleteResult,
  GhostCleanupResult,
  GhostDeleteResult,
  GhostDeletionImpact,
  GhostSummary,
  MediaStorageListResponse,
  MediaStorageSortBy,
  NotificationHealth,
  NotificationStats,
  PaginatedResponse,
  PushFailureSummary,
  PushGatewayHealth,
  PushPipelineStats,
  PushStats,
  PushSubscriptionAnalytics,
  RetentionMetrics,
  StaleDocument,
  StaleDocumentPreview,
  StaleDocumentsSummary,
  SupabaseStats,
  TableSize,
  TopViewedDocument,
  User,
  UserLifecycleSegments,
  UserNotificationSubs,
  ViewsSummary,
  ViewsTrendPoint,
  WorkspaceMediaStorageSummary
} from '@/types'

async function getAccessToken(): Promise<string> {
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  return session.access_token
}

/**
 * Generic fetch wrapper with error handling and authentication.
 * System-wide aggregates and the user/channel directory must route through the
 * admin-gated service_role API: the browser's anon-key client is RLS-scoped
 * (`email`, `push_subscriptions`, `email_queue` are revoked from `authenticated`).
 */
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken()

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))

    if (response.status === 401) {
      throw new Error('Session expired. Please log in again.')
    }
    if (response.status === 403) {
      throw new Error('Admin access required.')
    }

    throw new Error(error.error || `API error: ${response.status}`)
  }
  return response.json()
}

export async function fetchDashboardStats(): Promise<DashboardDocumentStats> {
  return fetchApi('/api/admin/stats')
}

export async function fetchDocumentStats(): Promise<DocumentStats> {
  return fetchApi('/api/admin/documents/stats')
}

export async function fetchUserDocumentCounts(): Promise<Record<string, number>> {
  return fetchApi('/api/admin/users/document-counts')
}

export async function fetchAdminUserIds(): Promise<Array<{ user_id: string; created_at: string }>> {
  return fetchApi('/api/admin/users/admins')
}

export async function toggleAdminRole(
  userId: string
): Promise<{ success: boolean; is_admin: boolean }> {
  return fetchApi(`/api/admin/users/${userId}/toggle-admin`, { method: 'POST' })
}

export async function fetchUsers(
  page: number,
  search: string,
  sortBy?: string,
  sortDir?: 'asc' | 'desc'
) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  if (sortBy) params.set('sortBy', sortBy)
  if (sortDir) params.set('sortDir', sortDir)
  return fetchApi<{ data: User[]; total: number; totalPages: number }>(
    `/api/admin/users?${params.toString()}`
  )
}

export async function fetchUserNotificationSubscriptions(): Promise<
  Record<string, UserNotificationSubs>
> {
  return fetchApi('/api/admin/users/notification-subs')
}

export async function fetchChannels(
  page: number,
  sortBy?: string,
  sortDir?: 'asc' | 'desc',
  search?: string
) {
  const params = new URLSearchParams({ page: String(page) })
  if (sortBy) params.set('sortBy', sortBy)
  if (sortDir) params.set('sortDir', sortDir)
  if (search) params.set('search', search)
  return fetchApi<{ data: Channel[]; total: number; totalPages: number }>(
    `/api/admin/channels?${params.toString()}`
  )
}

export async function fetchDocuments(
  page: number,
  limit = 20,
  sortBy?: string,
  sortDir?: 'asc' | 'desc',
  search?: string
): Promise<PaginatedResponse<Document>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  })
  if (sortBy) params.set('sortBy', sortBy)
  if (sortDir) params.set('sortDir', sortDir)
  if (search) params.set('search', search)
  return fetchApi(`/api/admin/documents?${params.toString()}`)
}

export async function updateDocumentFlags(
  id: string,
  flags: { isPrivate?: boolean; readOnly?: boolean }
): Promise<{ success: boolean; document: Document }> {
  return fetchApi(`/api/admin/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(flags)
  })
}

export async function getDocumentDeletionImpact(id: string): Promise<DeletionImpact> {
  return fetchApi(`/api/admin/documents/${id}/deletion-impact`)
}

export async function deleteDocument(
  id: string,
  confirmSlug: string
): Promise<{
  success: boolean
  deleted: { id: string; slug: string; title: string | null }
  workspaceDeleted: boolean
}> {
  return fetchApi(`/api/admin/documents/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirmSlug })
  })
}

export async function checkApiHealth(): Promise<{ status: string; latency: number }> {
  const start = Date.now()
  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    })
    return {
      status: response.ok ? 'healthy' : 'degraded',
      latency: Date.now() - start
    }
  } catch {
    return { status: 'down', latency: 0 }
  }
}

export async function fetchViewsSummary(): Promise<ViewsSummary> {
  return fetchApi('/api/admin/stats/views')
}

export async function fetchTopViewedDocuments(limit = 10, days = 7): Promise<TopViewedDocument[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    days: String(days)
  })
  return fetchApi(`/api/admin/stats/views/top?${params.toString()}`)
}

export async function fetchViewsTrend(days = 30, slug?: string): Promise<ViewsTrendPoint[]> {
  const params = new URLSearchParams({ days: String(days) })
  if (slug) params.set('slug', slug)
  return fetchApi(`/api/admin/stats/views/trend?${params.toString()}`)
}

export async function fetchBatchDocumentTrends(
  slugs: string[],
  days = 7
): Promise<Record<string, number[]>> {
  if (slugs.length === 0) return {}
  const params = new URLSearchParams({
    slugs: slugs.join(','),
    days: String(days)
  })
  return fetchApi(`/api/admin/stats/views/batch-trends?${params.toString()}`)
}

export async function fetchRetentionMetrics(): Promise<RetentionMetrics> {
  return fetchApi('/api/admin/stats/retention')
}

export async function fetchUserLifecycleSegments(): Promise<UserLifecycleSegments> {
  return fetchApi('/api/admin/stats/user-lifecycle')
}

export async function fetchDauTrend(days = 30): Promise<DauTrendPoint[]> {
  return fetchApi(`/api/admin/stats/dau-trend?days=${days}`)
}

export async function fetchNotificationStats(): Promise<NotificationStats> {
  return fetchApi('/api/admin/stats/notifications')
}

export async function fetchPushStats(): Promise<PushStats> {
  return fetchApi('/api/admin/stats/push')
}

export async function fetchEmailStats(): Promise<EmailStats> {
  return fetchApi('/api/admin/stats/email')
}

export async function fetchSupabaseStats(): Promise<SupabaseStats> {
  return fetchApi('/api/admin/stats/platform')
}

export async function fetchTableSizes(): Promise<TableSize[]> {
  return fetchApi('/api/admin/system/table-sizes')
}

export async function fetchMediaStorageSummary(): Promise<WorkspaceMediaStorageSummary> {
  return fetchApi('/api/admin/audit/media-storage/summary')
}

function mediaStorageListParams(options?: {
  page?: number
  limit?: number
  search?: string
  sortBy?: MediaStorageSortBy
  sortDir?: 'asc' | 'desc'
  scope?: 'page' | 'all'
}): URLSearchParams {
  const params = new URLSearchParams({
    page: String(options?.page ?? 1),
    limit: String(options?.limit ?? 20),
    scope: options?.scope ?? 'page'
  })
  if (options?.search) params.set('search', options.search)
  if (options?.sortBy) params.set('sortBy', options.sortBy)
  if (options?.sortDir) params.set('sortDir', options.sortDir)
  return params
}

export async function fetchMediaStorageList(
  page: number,
  limit = 20,
  options?: {
    search?: string
    sortBy?: MediaStorageSortBy
    sortDir?: 'asc' | 'desc'
  }
): Promise<MediaStorageListResponse> {
  const params = mediaStorageListParams({ page, limit, ...options, scope: 'page' })
  return fetchApi(`/api/admin/audit/media-storage?${params.toString()}`)
}

export async function fetchMediaStorageExport(options?: {
  search?: string
  sortBy?: MediaStorageSortBy
  sortDir?: 'asc' | 'desc'
}): Promise<MediaStorageListResponse> {
  const params = mediaStorageListParams({ ...options, scope: 'all', limit: 1, page: 1 })
  return fetchApi(`/api/admin/audit/media-storage?${params.toString()}`)
}

export async function fetchPushPipelineStats(): Promise<PushPipelineStats> {
  return fetchApi('/api/admin/stats/push/pipeline')
}

interface PushSubscriptionRow {
  platform: string
  updated_at: string
  created_at: string
  is_active: boolean
  failed_count: number
  last_error: string | null
}

/**
 * Fetch comprehensive push subscription analytics. Aggregates the fleet-wide
 * rows supplied by the service_role API; errors surface to React Query (no
 * silent all-zero state).
 */
export async function fetchPushSubscriptionAnalytics(): Promise<PushSubscriptionAnalytics> {
  const allSubs = await fetchApi<PushSubscriptionRow[]>('/api/admin/push/subscriptions')

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const activeSubs = allSubs.filter((s) => s.is_active)

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

  const newThisWeek = allSubs.filter((s) => s.is_active && new Date(s.created_at) >= weekAgo).length
  const churnedThisWeek = allSubs.filter(
    (s) => !s.is_active && new Date(s.updated_at) >= weekAgo
  ).length

  const errors: Record<string, number> = {}
  let totalErrors = 0
  allSubs
    .filter((s) => s.failed_count > 0 && s.last_error)
    .forEach((s) => {
      totalErrors++
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

export async function checkPushGatewayHealth(): Promise<PushGatewayHealth> {
  const start = Date.now()
  try {
    const response = await fetch(`${API_URL}/health/push`, {
      signal: AbortSignal.timeout(5000)
    })
    const latency = Date.now() - start

    if (!response.ok) {
      return {
        status: 'degraded',
        latency,
        vapidConfigured: false,
        queueConnected: false,
        error: `HTTP ${response.status}`
      }
    }

    const data = await response.json()
    return {
      status: data.vapid_configured && data.queue_connected ? 'healthy' : 'degraded',
      latency,
      vapidConfigured: data.vapid_configured ?? false,
      queueConnected: data.queue_connected ?? false,
      pendingJobs: data.pending_jobs ?? 0,
      failedJobs: data.failed_jobs ?? 0
    }
  } catch (err) {
    return {
      status: 'down',
      latency: 0,
      vapidConfigured: false,
      queueConnected: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

export async function checkEmailGatewayHealth(): Promise<EmailGatewayHealth> {
  const start = Date.now()
  try {
    const response = await fetch(`${API_URL}/api/email/health`, {
      signal: AbortSignal.timeout(5000)
    })
    const latency = Date.now() - start

    if (!response.ok) {
      return {
        status: 'degraded',
        latency,
        provider: null,
        queueConnected: false,
        error: `HTTP ${response.status}`
      }
    }

    const data = await response.json()
    return {
      status: data.smtp_configured || data.provider ? 'healthy' : 'degraded',
      latency,
      provider: data.provider ?? null,
      queueConnected: data.queue_connected ?? false,
      pendingJobs: data.pending_jobs ?? 0,
      failedJobs: data.failed_jobs ?? 0
    }
  } catch (err) {
    return {
      status: 'down',
      latency: 0,
      provider: null,
      queueConnected: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

export async function fetchStaleDocumentsSummary(): Promise<StaleDocumentsSummary> {
  return fetchApi('/api/admin/documents/stale/summary')
}

export async function fetchStaleDocuments(
  page: number,
  limit = 20,
  options?: {
    minScore?: number
    maxVersions?: number
    maxContentSize?: number
    minAgeDays?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
  }
): Promise<PaginatedResponse<StaleDocument>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  })
  if (options?.minScore !== undefined) params.set('minScore', String(options.minScore))
  if (options?.maxVersions !== undefined) params.set('maxVersions', String(options.maxVersions))
  if (options?.maxContentSize !== undefined)
    params.set('maxContentSize', String(options.maxContentSize))
  if (options?.minAgeDays !== undefined) params.set('minAgeDays', String(options.minAgeDays))
  if (options?.sortBy) params.set('sortBy', options.sortBy)
  if (options?.sortDir) params.set('sortDir', options.sortDir)

  return fetchApi(`/api/admin/documents/stale?${params.toString()}`)
}

export async function fetchDocumentPreview(slug: string): Promise<StaleDocumentPreview> {
  return fetchApi(`/api/admin/documents/${slug}/preview`)
}

export async function bulkDeleteStaleDocuments(
  slugs: string[],
  dryRun = false
): Promise<{
  success: boolean
  deleted: number
  failed: number
  workspacesDeleted: number
  deletedDocuments: { slug: string; title: string | null }[]
  failedDocuments: { slug: string; error: string }[]
}> {
  return fetchApi('/api/admin/documents/stale/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ slugs, dryRun })
  })
}

export async function fetchNotificationHealth(): Promise<NotificationHealth> {
  return fetchApi('/api/admin/audit/notifications/health')
}

export async function fetchPushFailureSummary(): Promise<PushFailureSummary[]> {
  return fetchApi('/api/admin/audit/notifications/push-failures')
}

export async function fetchEmailFailureSummary(): Promise<EmailFailureSummary[]> {
  return fetchApi('/api/admin/audit/notifications/email-failures')
}

export async function fetchAuditFailedSubscriptions(
  minFailures = 1,
  limit = 100
): Promise<AuditFailedSubscription[]> {
  const params = new URLSearchParams({
    minFailures: String(minFailures),
    limit: String(limit)
  })
  return fetchApi(`/api/admin/audit/notifications/failed-subscriptions?${params.toString()}`)
}

export async function fetchEmailBounces(options?: {
  bounceType?: string
  days?: number
  limit?: number
}): Promise<EmailBounce[]> {
  const params = new URLSearchParams()
  if (options?.bounceType) params.set('bounceType', options.bounceType)
  if (options?.days) params.set('days', String(options.days))
  if (options?.limit) params.set('limit', String(options.limit))
  return fetchApi(`/api/admin/audit/notifications/email-bounces?${params.toString()}`)
}

export async function disableFailedSubscriptions(
  minFailures: number,
  errorPattern?: string,
  subscriptionIds?: string[]
): Promise<DisableResult> {
  return fetchApi('/api/admin/audit/notifications/disable-failed', {
    method: 'POST',
    body: JSON.stringify({ minFailures, errorPattern, subscriptionIds })
  })
}

export async function fetchDLQContents(limit = 20): Promise<DLQContents> {
  return fetchApi(`/api/admin/audit/notifications/dlq?limit=${limit}`)
}

export async function fetchGhostAccounts(options?: {
  minAgeDays?: number
  ghostType?: string
  page?: number
  perPage?: number
}): Promise<GhostAccountsResponse> {
  const params = new URLSearchParams()
  if (options?.minAgeDays) params.set('minAgeDays', String(options.minAgeDays))
  if (options?.ghostType) params.set('ghostType', options.ghostType)
  if (options?.page) params.set('page', String(options.page))
  if (options?.perPage) params.set('perPage', String(options.perPage))
  return fetchApi(`/api/admin/audit/ghost-accounts?${params.toString()}`)
}

export async function fetchGhostSummary(): Promise<GhostSummary> {
  return fetchApi('/api/admin/audit/ghost-accounts/summary')
}

export async function fetchGhostDeletionImpact(userId: string): Promise<GhostDeletionImpact> {
  return fetchApi(`/api/admin/audit/ghost-accounts/${userId}/impact`)
}

export async function deleteGhostAccount(userId: string): Promise<GhostDeleteResult> {
  return fetchApi(`/api/admin/audit/ghost-accounts/${userId}`, {
    method: 'DELETE'
  })
}

export async function bulkDeleteGhostAccounts(userIds: string[]): Promise<GhostBulkDeleteResult> {
  return fetchApi('/api/admin/audit/ghost-accounts/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ userIds })
  })
}

export async function resendGhostConfirmation(email: string): Promise<{ success: boolean }> {
  return fetchApi('/api/admin/audit/ghost-accounts/resend-confirmation', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

export async function cleanupAnonymousSessions(minAgeDays = 90): Promise<GhostCleanupResult> {
  return fetchApi('/api/admin/audit/ghost-accounts/cleanup-anonymous', {
    method: 'POST',
    body: JSON.stringify({ minAgeDays })
  })
}
