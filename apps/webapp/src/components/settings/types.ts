import type { LinkItem, LinkMetadata } from '@types'
import { LinkType } from '@types'
import type { IconType } from 'react-icons'

export type { LinkItem, LinkMetadata }
export { LinkType }

export type SupportInk = 'accent' | 'warning' | 'error'

export type SupportRow =
  | {
      kind: 'link'
      href: string
      label: string
      icon: IconType
      ink: SupportInk
      burst?: 'star'
    }
  | {
      kind: 'action'
      label: string
      icon: IconType
      ink: SupportInk
    }

export type EmailFrequency = 'immediate' | 'daily' | 'weekly' | 'never'

export type TabType =
  'profile' | 'documents' | 'appearance' | 'security' | 'notifications' | 'connected-apps'

export type DocumentSortKey =
  'updatedAt_desc' | 'createdAt_desc' | 'lastOpenedAt_desc' | 'title_asc' | 'title_desc'

export interface OwnedDocument {
  documentId: string
  slug: string
  title: string | null
  readOnly: boolean
  isPrivate: boolean
  updatedAt: string
  createdAt: string
  lastOpenedAt?: string | null // Owner lists only. Fleet, slug GET, create, and update omit it.
  // Populated only in the Trash view (soft-deleted rows); null/absent on live docs.
  deletedAt?: string | null
  // Owner live list only. Favorites sit first. Trash omits this.
  isFavorite?: boolean
  // Owner live list and Owner Trash. Omitted or null = never extracted. `{ heading: null, lines: [] }` = empty or failed extract.
  preview?: DocumentGridPreview | null
}

export type DocumentGridPreview = {
  heading: string | null
  lines: string[]
  list?: string[]
  imageSrc?: string
}

export type DocumentsPage = { docs: OwnedDocument[]; total: number }

export interface SettingsPanelProps {
  defaultTab?: TabType
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
  email_content_changes?: boolean
  email_frequency?: EmailFrequency
  // `null` is the "clear-on-re-enable" wire sentinel; the FE truthy-check
  // at the banner site hides JSON-null.
  email_bounce_info?: EmailBounceInfo | null
}

export type ConnectRowAction =
  { kind: 'link'; label: string; href: string } | { kind: 'copy'; label: string; text: string }

export interface ConnectRow {
  name: string
  mark: string
  where?: string
  note: string
  // `text` must appear in `note` and `phone.note` (checked in dev in connectRows.ts);
  // that part renders as a link to the app's own page.
  link?: { text: string; href: string }
  command?: string
  action?: ConnectRowAction
  // Custom-scheme links and terminal commands do nothing on a phone.
  desktopOnly?: boolean
  phoneOnly?: boolean
  phone?: Pick<ConnectRow, 'where' | 'note'>
}

// One row per client name. DCR registers a new client for each fresh connection.
export interface ConnectedAppGroup {
  name: string
  clientIds: string[]
  grantedAt: string
}
