import { API_URL } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import type {
  ActivityHeatmapPoint,
  CommunicationStats,
  DashboardDocumentStats,
  DauTrendPoint,
  Document,
  DocumentStats,
  DocumentViewStats,
  NotificationReach,
  PaginatedResponse,
  RetentionMetrics,
  TopActiveDocument,
  TopViewedDocument,
  UserLifecycleSegments,
  ViewsSummary,
  ViewsTrendPoint
} from '@/types'

/**
 * Get the current session's access token
 * Throws if not authenticated
 */
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
 * Generic fetch wrapper with error handling and authentication
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

    // Handle authentication errors
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

/**
 * Fetch dashboard statistics from hocuspocus API
 */
export async function fetchDashboardStats(): Promise<DashboardDocumentStats> {
  return fetchApi('/api/admin/stats')
}

/**
 * Fetch document-specific statistics
 */
export async function fetchDocumentStats(): Promise<DocumentStats> {
  return fetchApi('/api/admin/documents/stats')
}

/**
 * Fetch document counts per user (userId -> count)
 */
export async function fetchUserDocumentCounts(): Promise<Record<string, number>> {
  return fetchApi('/api/admin/users/document-counts')
}

/**
 * Fetch paginated documents list with optional sorting
 */
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

/**
 * Update document flags
 */
export async function updateDocumentFlags(
  id: string,
  flags: { isPrivate?: boolean; readOnly?: boolean }
): Promise<{ success: boolean; document: Document }> {
  return fetchApi(`/api/admin/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(flags)
  })
}

/**
 * Get deletion impact - checks what will be deleted with owner and channel info
 */
export interface DeletionImpact {
  document: {
    id: number
    slug: string
    title: string | null
    versionCount: number
    createdAt: string
  }
  owner: {
    username: string | null
    email: string | null
  } | null
  workspace: {
    id: string
    channelCount: number
  } | null
}

export async function getDocumentDeletionImpact(id: string): Promise<DeletionImpact> {
  return fetchApi(`/api/admin/documents/${id}/deletion-impact`)
}

/**
 * Delete a document (requires confirmation by typing slug)
 */
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

/**
 * Check REST API health
 */
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

// =============================================================================
// Document View Analytics API
// =============================================================================

/**
 * Fetch document views summary (overall stats)
 */
export async function fetchViewsSummary(): Promise<ViewsSummary> {
  return fetchApi('/api/admin/stats/views')
}

/**
 * Fetch top viewed documents
 */
export async function fetchTopViewedDocuments(limit = 10, days = 7): Promise<TopViewedDocument[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    days: String(days)
  })
  return fetchApi(`/api/admin/stats/views/top?${params.toString()}`)
}

/**
 * Fetch view trends for charts
 */
export async function fetchViewsTrend(days = 30, slug?: string): Promise<ViewsTrendPoint[]> {
  const params = new URLSearchParams({ days: String(days) })
  if (slug) params.set('slug', slug)
  return fetchApi(`/api/admin/stats/views/trend?${params.toString()}`)
}

/**
 * Fetch single document view stats
 */
export async function fetchDocumentViewStats(slug: string): Promise<DocumentViewStats> {
  return fetchApi(`/api/admin/documents/${slug}/views`)
}

/**
 * Fetch batch document trends for sparklines
 */
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

// =============================================================================
// User Retention Analytics API (Phase 8)
// =============================================================================

/**
 * Fetch retention metrics (DAU/WAU/MAU)
 */
export async function fetchRetentionMetrics(): Promise<RetentionMetrics> {
  return fetchApi('/api/admin/stats/retention')
}

/**
 * Fetch user lifecycle segments
 */
export async function fetchUserLifecycleSegments(): Promise<UserLifecycleSegments> {
  return fetchApi('/api/admin/stats/user-lifecycle')
}

/**
 * Fetch DAU trend over time
 */
export async function fetchDauTrend(days = 30): Promise<DauTrendPoint[]> {
  return fetchApi(`/api/admin/stats/dau-trend?days=${days}`)
}

/**
 * Fetch activity by hour (for heatmap)
 */
export async function fetchActivityHeatmap(days = 7): Promise<ActivityHeatmapPoint[]> {
  return fetchApi(`/api/admin/stats/activity-heatmap?days=${days}`)
}

/**
 * Fetch top active documents (by messages)
 */
export async function fetchTopActiveDocuments(limit = 5, days = 7): Promise<TopActiveDocument[]> {
  return fetchApi(`/api/admin/stats/top-active-documents?limit=${limit}&days=${days}`)
}

/**
 * Fetch communication stats
 */
export async function fetchCommunicationStats(days = 7): Promise<CommunicationStats> {
  return fetchApi(`/api/admin/stats/communication?days=${days}`)
}

/**
 * Fetch notification reach
 */
export async function fetchNotificationReach(): Promise<NotificationReach> {
  return fetchApi('/api/admin/stats/notification-reach')
}

// =============================================================================
// Push Gateway Health API
// =============================================================================

export interface PushGatewayHealth {
  status: 'healthy' | 'degraded' | 'down'
  latency: number
  vapidConfigured: boolean
  queueConnected: boolean
  pendingJobs?: number
  failedJobs?: number
  error?: string
}

/**
 * Check push gateway health (hocuspocus.server /health/push)
 */
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

/**
 * Check email gateway health (hocuspocus.server /api/email/health)
 */
export interface EmailGatewayHealth {
  status: 'healthy' | 'degraded' | 'down'
  latency: number
  provider: string | null
  queueConnected: boolean
  pendingJobs?: number
  failedJobs?: number
  error?: string
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

// =============================================================================
// Stale Documents Audit API (Phase 13)
// =============================================================================

import type { StaleDocument, StaleDocumentPreview, StaleDocumentsSummary } from '@/types'

/**
 * Fetch stale documents summary statistics
 */
export async function fetchStaleDocumentsSummary(): Promise<StaleDocumentsSummary> {
  return fetchApi('/api/admin/documents/stale/summary')
}

/**
 * Fetch paginated stale documents list with filters
 */
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

/**
 * Get document content preview for stale document audit
 */
export async function fetchDocumentPreview(slug: string): Promise<StaleDocumentPreview> {
  return fetchApi(`/api/admin/documents/${slug}/preview`)
}

/**
 * Bulk delete stale documents
 */
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
