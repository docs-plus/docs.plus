// User types
export interface User {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  avatar_updated_at: string | null;
  status: string;
  created_at: string;
  online_at: string | null;
}

// Document types
export interface Document {
  id: string;
  docId: string;
  title: string | null;
  headline: string | null;
  isPrivate: boolean;
  readOnly: boolean;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerAvatarUrl: string | null;
  ownerAvatarUpdatedAt: string | null;
  memberCount: number;
  // View analytics (optional - may not be present if view tracking not enabled)
  views7d?: number;
  viewsTotal?: number;
}

export interface DocumentStats {
  total: number;
  private: number;
  readOnly: number;
  totalVersions: number;
  avgVersionsPerDoc: number;
  recentlyCreated?: number;
  recentActivity?: number;
}

// Channel types
export interface Channel {
  id: string;
  workspace_id: string | null;
  name: string | null;
  type: string;
  member_count: number;
  last_activity_at: string | null;
  created_at: string;
  // Document info (from workspace)
  document_slug: string | null;
  document_name: string | null;
}

export interface ChannelStats {
  total: number;
  byType: Record<string, number>;
}

// Notification types
export interface NotificationStats {
  total: number;
  unread: number;
  readRate: number;
  byType: Record<string, number>;
}

export interface PushStats {
  active: number;
  failed: number;
}

export interface EmailStats {
  pending: number;
  sent: number;
  failed: number;
}

// System types
export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  lastCheck: string;
}

export interface TableSize {
  table: string;
  rows: number;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Dashboard stats
export interface DashboardDocumentStats {
  documents: DocumentStats;
  refreshedAt: string;
}

export interface SupabaseStats {
  users: {
    total: number;
    online: number;
    newThisWeek: number;
  };
  channels: {
    total: number;
    byType: Record<string, number>;
  };
  messages: {
    total: number;
    today: number;
  };
  notifications: {
    total: number;
    unread: number;
  };
}

// =============================================================================
// Document View Analytics Types
// =============================================================================

export interface ViewsSummary {
  total_views: number;
  unique_visitors: number;
  views_today: number;
  views_7d: number;
  views_30d: number;
  avg_duration_ms: number;
  bounce_rate: number;
  user_types: {
    authenticated: number;
    anonymous: number;
    guest: number;
  };
  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
}

export interface TopViewedDocument {
  document_slug: string;
  title?: string;
  views: number;
  unique_users?: number;      // Frontend naming
  unique_visitors?: number;   // SQL function naming
  avg_duration_ms?: number;
  bounce_rate?: number;
}

export interface ViewsTrendPoint {
  view_date: string;
  views: number;
  unique_sessions: number;
  unique_users: number;
  avg_duration_ms: number;
  bounce_count: number;
}

export interface DocumentViewStats {
  document_slug: string;
  total_views: number;
  unique_users: number;
  views_today: number;
  views_7d: number;
  views_30d: number;
  avg_duration_ms: number;
  bounce_rate: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  user_types: {
    authenticated: number;
    anonymous: number;
    guest: number;
  };
}

// =============================================================================
// User Retention Analytics Types (Phase 8)
// =============================================================================

export interface RetentionMetrics {
  dau: number;
  wau: number;
  mau: number;
  dau_prev: number;
  wau_prev: number;
  mau_prev: number;
  total_users: number;
  stickiness: number;
  dau_change_pct: number;
  wau_change_pct: number;
  mau_change_pct: number;
}

export interface UserLifecycleSegments {
  new: number;
  active: number;
  at_risk: number;
  churned: number;
  total: number;
  new_pct: number;
  active_pct: number;
  at_risk_pct: number;
  churned_pct: number;
}

export interface DauTrendPoint {
  activity_date: string;
  active_users: number;
}

export interface ActivityHeatmapPoint {
  hour_of_day: number;
  day_of_week: number;
  message_count: number;
}

export interface TopActiveDocument {
  workspace_id: string;
  document_slug: string;
  title: string;
  message_count: number;
  unique_users: number;
}

export interface CommunicationStats {
  total_messages: number;
  thread_messages: number;
  messages_with_reactions: number;
  unique_senders: number;
  thread_rate: number;
  reaction_rate: number;
}

export interface NotificationReach {
  total_users: number;
  push_enabled: number;
  email_enabled: number;
  push_reach_pct: number;
  email_reach_pct: number;
  notification_read_rate: number;
}
