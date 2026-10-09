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
  // Owned rows in an owner list only. A row the caller does not own never carries it.
  lastOpenedAt?: string | null
  // Populated only in the Trash view (soft-deleted rows); null/absent on live docs.
  deletedAt?: string | null
  // Owned rows in the live list only. Favorites sit first. Trash omits this.
  isFavorite?: boolean
  // Null on an ownerless pad. `isOwner` is ownerId === the caller; an old server omits it.
  ownerId?: string | null
  isOwner?: boolean
  // Set when the row has an owner whose profile resolves.
  owner?: DocumentOwner
  // Every live-list scope and Owner Trash. Omitted or null = never extracted. `{ heading: null, lines: [] }` = empty or failed extract.
  preview?: DocumentGridPreview | null
}

/** The server folds `full_name` into `display_name`, so this is the name to show. */
export type DocumentOwner = {
  id: string
  display_name: string | null
  avatar_url: string | null
  avatar_updated_at: string | null
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
