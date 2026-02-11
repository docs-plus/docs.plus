// User types
export interface User {
  id: string
  username: string | null
  email: string | null
  full_name: string | null
  avatar_url: string | null
  avatar_updated_at: string | null
  status: string
  created_at: string
  online_at: string | null
}

// Document types
export interface Document {
  id: string
  docId: string
  title: string | null
  headline: string | null
  isPrivate: boolean
  readOnly: boolean
  createdAt: string
  updatedAt: string
  versionCount: number
  ownerId: string | null
  ownerName: string | null
  ownerEmail: string | null
  ownerAvatarUrl: string | null
  ownerAvatarUpdatedAt: string | null
  memberCount: number
  // View analytics (optional - may not be present if view tracking not enabled)
  views7d?: number
  uniqueUsers7d?: number
  viewsTotal?: number
  // Sparkline trend data (7-day)
  viewsTrend?: number[]
}

export interface DocumentStats {
  total: number
  private: number
  readOnly: number
  totalVersions: number
  avgVersionsPerDoc: number
  recentlyCreated?: number
  recentActivity?: number
}

// Channel types
export interface Channel {
  id: string
  workspace_id: string | null
  name: string | null
  type: string
  member_count: number
  last_activity_at: string | null
  created_at: string
  // Document info (from workspace)
  document_slug: string | null
  document_name: string | null
}

export interface ChannelStats {
  total: number
  byType: Record<string, number>
}

// Notification types
export interface NotificationStats {
  total: number
  unread: number
  readRate: number
  byType: Record<string, number>
}

export interface PushStats {
  active: number
  failed: number
}

export interface EmailStats {
  pending: number
  sent: number
  failed: number
}

// System types
export interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  latency?: number
  lastCheck: string
}

export interface TableSize {
  table: string
  rows: number
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Dashboard stats
export interface DashboardDocumentStats {
  documents: DocumentStats
  refreshedAt: string
}

export interface SupabaseStats {
  users: {
    total: number
    online: number
    newThisWeek: number
  }
  channels: {
    total: number
    byType: Record<string, number>
  }
  messages: {
    total: number
    today: number
  }
  notifications: {
    total: number
    unread: number
  }
}

// =============================================================================
// Document View Analytics Types
// =============================================================================

export interface ViewsSummary {
  total_views: number
  unique_visitors: number
  views_today: number
  views_7d: number
  views_30d: number
  avg_duration_ms: number
  bounce_rate: number
  user_types: {
    authenticated: number
    anonymous: number
    guest: number
  }
  devices: {
    desktop: number
    mobile: number
    tablet: number
  }
}

export interface TopViewedDocument {
  document_slug: string
  title?: string
  views: number
  unique_users?: number // Frontend naming
  unique_visitors?: number // SQL function naming
  avg_duration_ms?: number
  bounce_rate?: number
}

export interface ViewsTrendPoint {
  view_date: string
  views: number
  unique_sessions: number
  unique_users: number
  avg_duration_ms: number
  bounce_count: number
}

export interface DocumentViewStats {
  document_slug: string
  total_views: number
  unique_users: number
  views_today: number
  views_7d: number
  views_30d: number
  avg_duration_ms: number
  bounce_rate: number
  first_viewed_at: string | null
  last_viewed_at: string | null
  devices: {
    desktop: number
    mobile: number
    tablet: number
  }
  user_types: {
    authenticated: number
    anonymous: number
    guest: number
  }
}

// =============================================================================
// User Retention Analytics Types (Phase 8)
// =============================================================================

export interface RetentionMetrics {
  dau: number
  wau: number
  mau: number
  dau_prev: number
  wau_prev: number
  mau_prev: number
  total_users: number
  stickiness: number
  dau_change_pct: number
  wau_change_pct: number
  mau_change_pct: number
}

export interface UserLifecycleSegments {
  new: number
  active: number
  at_risk: number
  churned: number
  total: number
  new_pct: number
  active_pct: number
  at_risk_pct: number
  churned_pct: number
}

export interface DauTrendPoint {
  activity_date: string
  active_users: number
}

export interface ActivityHeatmapPoint {
  hour_of_day: number
  day_of_week: number
  message_count: number
}

export interface TopActiveDocument {
  workspace_id: string
  document_slug: string
  title: string
  message_count: number
  unique_users: number
}

export interface CommunicationStats {
  total_messages: number
  thread_messages: number
  messages_with_reactions: number
  unique_senders: number
  thread_rate: number
  reaction_rate: number
}

export interface NotificationReach {
  total_users: number
  push_enabled: number
  email_enabled: number
  push_reach_pct: number
  email_reach_pct: number
  notification_read_rate: number
}

// =============================================================================
// Push Notification Debugging Types
// =============================================================================

export interface PushGatewayHealth {
  status: 'healthy' | 'degraded' | 'down'
  latency: number
  vapidConfigured: boolean
  queueConnected: boolean
  pendingJobs?: number
  error?: string
}

// PgNetResponse removed - pgmq architecture doesn't use pg_net

export interface PushSubscriptionDetail {
  id: string
  user_id: string
  username: string | null
  device_name: string | null
  platform: string
  is_active: boolean
  failed_count: number
  last_error: string | null
  last_used_at: string | null
  created_at: string
}

export interface PushPipelineStats {
  // pgmq consumer status
  triggerConfigured: boolean
  consumerStatus?: 'idle' | 'healthy' | 'backlog' | 'critical'
  // pgmq queue stats
  queueDepth: number
  oldestMessageAge?: number // seconds
  messagesProcessed: number
  messagesFailed: number
  // Push subscription stats
  totalSubscriptions: number
  activeSubscriptions: number
  failedSubscriptions: number
  // Recent activity
  lastPushSent: string | null
  lastPushError: string | null
}

export interface RecentPushAttempt {
  id: string
  notification_id: string
  notification_type: string
  receiver_username: string | null
  created_at: string
  queue_status: string | null
  push_sent: boolean
  error?: string | null
}

export interface PushDebugStats {
  gateway: PushGatewayHealth
  pipeline: PushPipelineStats
  failedSubscriptions: PushSubscriptionDetail[]
  recentAttempts: RecentPushAttempt[]
}

// =============================================================================
// Push Subscription Analytics Types (v6.3.0)
// =============================================================================

export interface PushSubscriptionAnalytics {
  // Platform breakdown
  platforms: {
    web: number
    ios: number
    android: number
    desktop: number
    total: number
  }
  // Subscription health
  health: {
    fresh: number // < 7 days
    ok: number // 7-30 days
    stale: number // > 30 days
    avgAgeDays: number
  }
  // Lifecycle
  lifecycle: {
    newThisWeek: number
    churnedThisWeek: number // became inactive
    total: number
  }
  // Errors (from last_error field)
  errors: {
    total: number
    byType: Record<string, number>
  }
}

export interface PlatformTrendPoint {
  date: string
  web: number
  ios: number
  android: number
}

// =============================================================================
// Stale Documents Audit Types (Phase 13)
// =============================================================================

export type StaleSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface DocumentStructure {
  headings: number
  paragraphs: number
}

export interface StaleDocument {
  slug: string
  title: string | null
  created_at: string
  updated_at: string
  is_private: boolean
  version_count: number
  age_days: number
  days_inactive: number
  stale_score: number
  stale_reason: string
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  owner_avatar_url: string | null
  structure: DocumentStructure
  // View analytics (industry-standard staleness detection)
  views_7d: number
  views_30d: number
}

export interface StaleDocumentsSummary {
  total_stale: number
  truly_abandoned: number // No views AND no edits for 90+ days
  ghost_document: number // Never viewed, barely edited
  declining: number // No recent views, no recent edits
  low_engagement: number // Minimal activity
  recoverable_bytes: number
}

// =============================================================================
// Failed Notifications Audit Types (Phase 17)
// =============================================================================

export interface NotificationHealth {
  push: {
    total_subscriptions: number
    active_subscriptions: number
    failed_subscriptions: number
    disabled_subscriptions: number
    expired_subscriptions: number
    delivery_rate: number
  }
  email: {
    total_queued: number
    sent: number
    failed: number
    pending: number
    skipped: number
    hard_bounces: number
    soft_bounces: number
    complaints: number
    delivery_rate: number
  }
}

export interface PushFailureSummary {
  error_category: string
  platform: string
  failure_count: number
  affected_users: number
  last_failure_at: string
  sample_errors: string[]
}

export interface EmailFailureSummary {
  source: 'queue' | 'bounce'
  error_category: string
  failure_count: number
  affected_users: number
  last_failure_at: string
}

export interface AuditFailedSubscription {
  subscription_id: string
  user_id: string
  username: string | null
  user_email: string | null
  platform: string
  error_category: string
  last_error: string | null
  failed_count: number
  is_active: boolean
  last_failure_at: string
  created_at: string
}

export interface EmailBounce {
  bounce_id: string
  email: string
  bounce_type: string
  provider: string | null
  reason: string | null
  user_id: string | null
  username: string | null
  bounced_at: string
}

export interface DLQJob {
  id: string
  name: string
  data: Record<string, unknown>
  timestamp: number
  failedReason: string | null
}

export interface DLQContents {
  push: { jobs: DLQJob[]; count: number }
  email: { jobs: DLQJob[]; count: number }
}

export interface DisableResult {
  success: boolean
  disabled_count: number
  subscription_ids: string[]
}

// =============================================================================
// Ghost Accounts Audit (Phase 15)
// =============================================================================

export type GhostType =
  | 'unconfirmed_magic_link'
  | 'abandoned_sso'
  | 'stale_unconfirmed'
  | 'never_signed_in'
  | 'no_public_profile'
  | 'stale_anonymous'
  | 'orphaned_anonymous'

export interface GhostAccount {
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

export interface GhostAccountsResponse {
  ghosts: GhostAccount[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface GhostSummary {
  total_ghosts: number
  total_auth_users: number
  oldest_ghost_days: number
  by_type: Record<GhostType, number>
  public_users: {
    total_public_users: number
    never_active_count: number
    soft_deleted_count: number
    active_count: number
  }
}

export interface GhostDeletionImpact {
  message_count: number
  channel_memberships: number
  push_subscriptions: number
  email_queue_items: number
  notifications_received: number
  has_blocking_messages: boolean
}

export interface GhostDeleteResult {
  success: boolean
  strategy: 'hard_delete' | 'soft_delete'
  reason?: string
}

export interface GhostBulkDeleteResult {
  success: boolean
  hard_deleted: number
  soft_deleted: number
  failed: number
  errors: string[]
}

export interface GhostCleanupResult {
  success: boolean
  deleted: number
  failed: number
  remaining: number
}

// =============================================================================
// Stale Documents (Phase 13)
// =============================================================================

export interface StaleDocumentPreview {
  slug: string
  title: string | null
  content_preview: string
  version_count: number
  created_at: string
  updated_at: string
  owner: {
    username: string | null
    email: string | null
  } | null
  deletion_impact: {
    workspace_id: string | null
    channel_count: number
    message_count: number
  }
}
