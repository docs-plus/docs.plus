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
}

// Search documents parameters
export interface SearchDocumentsParams {
  title?: string
  keywords?: string
  description?: string
  limit: number
  offset: number
}

// History payload for version control
export interface HistoryPayload {
  type: string
  documentId: string
  version?: number
  currentVersion?: number
  msg?: string
}
