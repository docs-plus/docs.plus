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
