export enum LinkType {
  Email = 'email',
  Social = 'social',
  Simple = 'simple',
  Phone = 'phone'
}

export interface LinkMetadata {
  title: string
  description: string
  icon: string
  themeColor?: string
}

export interface LinkItem {
  url: string
  type: LinkType
  metadata: LinkMetadata
}

// --- Notification types ---

export interface EmailBounceInfo {
  email: string
  reason: string
  bounced_at: string
}

export interface NotificationPreferences {
  // Push preferences
  push_mentions?: boolean
  push_replies?: boolean
  push_reactions?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  timezone?: string
  // Email preferences
  email_enabled?: boolean
  email_mentions?: boolean
  email_replies?: boolean
  email_reactions?: boolean
  email_frequency?: 'immediate' | 'daily' | 'weekly' | 'never'
  // Bounce info (set by system when hard bounce occurs)
  email_bounce_info?: EmailBounceInfo
}
