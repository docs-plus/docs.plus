import type { LinkItem, LinkMetadata } from '@types'
import { LinkType } from '@types'

export type { LinkItem, LinkMetadata }
export { LinkType }

export type TabType = 'profile' | 'documents' | 'appearance' | 'security' | 'notifications'

export type DocumentSortKey = 'updatedAt_desc' | 'createdAt_desc' | 'title_asc' | 'title_desc'

export interface OwnedDocument {
  documentId: string
  slug: string
  title: string | null
  readOnly: boolean
  isPrivate: boolean
  updatedAt: string
  createdAt: string
  // Populated only in the Trash view (soft-deleted rows); null/absent on live docs.
  deletedAt?: string | null
}

export type DocumentsPage = { docs: OwnedDocument[]; total: number }

export interface SettingsPanelProps {
  /** Initial active tab */
  defaultTab?: TabType
  /** Callback to close the modal */
  onClose?: () => void
}

export interface EmailBounceInfo {
  email: string
  reason: string
  bounced_at: string
}

export interface NotificationPreferences {
  push_mentions?: boolean
  push_replies?: boolean
  push_reactions?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  timezone?: string
  email_enabled?: boolean
  email_mentions?: boolean
  email_replies?: boolean
  email_reactions?: boolean
  email_frequency?: 'immediate' | 'daily' | 'weekly' | 'never'
  // `null` is the "clear-on-re-enable" wire sentinel; the FE truthy-check
  // at the banner site hides JSON-null.
  email_bounce_info?: EmailBounceInfo | null
}
