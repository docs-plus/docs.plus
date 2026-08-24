export interface StorageUploadResponse {
  type: 'localStorage' | 's3'
  error: boolean
  fileAddress: string
  fileType: string
  fileName?: string
}

export type FileTypeCategory = 'image' | 'video' | 'audio' | 'unknown'

export interface MimeTypeMap {
  image: Set<string>
  video: Set<string>
  audio: Set<string>
}
