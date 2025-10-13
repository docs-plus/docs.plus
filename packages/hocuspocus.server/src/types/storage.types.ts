// Storage response for uploads
export interface StorageUploadResponse {
  type: 'localStorage' | 's3'
  error: boolean
  fileAddress: string
  fileType: string
  fileName?: string
}

// File type categories
export type FileTypeCategory = 'image' | 'video' | 'audio' | 'unknown'

// MIME type mapping
export interface MimeTypeMap {
  image: Set<string>
  video: Set<string>
  audio: Set<string>
}
