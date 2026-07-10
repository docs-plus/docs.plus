// Document metadata interface
export interface DocumentMetadata {
  id: number
  slug: string
  title: string | null
  description: string | null
  keywords: string | null
  isPrivate: boolean
  readOnly: boolean
  ownerId: string | null
  email: string | null
  documentId: string
  createdAt: Date
  updatedAt: Date
}

// Create document parameters
export interface CreateDocumentParams {
  slug: string
  title: string
  description?: string
  keywords?: string[]
  userId?: string
  email?: string
}

// Update document parameters
export interface UpdateDocumentParams {
  title?: string
  description?: string
  keywords?: string[]
  readOnly?: boolean
  isPrivate?: boolean
}

// Allowlisted list sort keys — mapped to a fixed Prisma orderBy in the service.
export type DocumentSortKey = 'updatedAt_desc' | 'createdAt_desc' | 'title_asc' | 'title_desc'

// Search documents parameters
export interface SearchDocumentsParams {
  title?: string
  keywords?: string
  description?: string
  ownerId?: string
  // Verified caller (token.sub); absence or a missing ownerId clamps private rows out.
  requesterId?: string
  // Trash view: return the owner's soft-deleted docs (deletedAt set) instead of live ones.
  deleted?: boolean
  sort?: DocumentSortKey
  limit: number
  offset: number
}

// History payload for version control
export interface HistoryPayload {
  type: string
  documentId: string
  version?: number
  msg?: string
}
