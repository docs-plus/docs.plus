import type { FileTypeCategory } from '../../types'

/**
 * Extracts the file type category from a MIME type. MIME types follow the
 * pattern: type/subtype (e.g., "image/jpeg", "video/mp4"). This handles every
 * subtype without maintaining a hardcoded list.
 */
export const extractFileType = (mimeType: string): FileTypeCategory => {
  if (!mimeType) return 'unknown'

  // Parse the MIME type - first part is the category
  const [type] = mimeType.toLowerCase().split('/')

  // Return the type if it's one we care about
  if (type === 'image' || type === 'video' || type === 'audio') {
    return type
  }

  return 'unknown'
}
