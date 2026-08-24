import type { FileTypeCategory } from '../../types'

export const extractFileType = (mimeType: string): FileTypeCategory => {
  if (!mimeType) return 'unknown'

  const [type] = mimeType.toLowerCase().split('/')

  if (type === 'image' || type === 'video' || type === 'audio') {
    return type
  }

  return 'unknown'
}
