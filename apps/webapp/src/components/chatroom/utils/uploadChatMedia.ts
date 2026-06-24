import { removeFileFromStorage, uploadFileToStorageWithProgress } from '@api'
import type { MessageMediaItem } from '@types'

import { chatMediaStorageExtension, resolveChatMediaMime } from './chatMediaMime'
import {
  CHAT_MEDIA_BUCKET,
  CHAT_MEDIA_MAX_BYTES,
  inferMessageMediaKind,
  mediaStoragePath
} from './messageMediaPaths'

export type UploadChatMediaOptions = {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export const deleteChatMediaFromStorage = async (item: MessageMediaItem): Promise<void> => {
  const storagePath = mediaStoragePath(item)
  if (!storagePath) return

  const { error } = await removeFileFromStorage(CHAT_MEDIA_BUCKET, storagePath)
  if (error) {
    console.warn('[chat-media] failed to delete storage object', storagePath, error)
  }
}

export const uploadChatMedia = async (
  file: File,
  userId: string,
  channelId: string,
  options: UploadChatMediaOptions = {}
): Promise<MessageMediaItem> => {
  if (file.size > CHAT_MEDIA_MAX_BYTES) {
    throw new Error('File must be 10 MB or smaller')
  }

  const type = inferMessageMediaKind(file)
  const storagePath = `${userId}/${channelId}/${crypto.randomUUID()}.${chatMediaStorageExtension(file)}`
  const contentType = resolveChatMediaMime(file) || undefined

  const { error } = await uploadFileToStorageWithProgress(
    CHAT_MEDIA_BUCKET,
    storagePath,
    file,
    contentType,
    options
  )

  if (error) {
    const message =
      typeof error.message === 'string' && error.message.trim()
        ? error.message
        : 'Failed to upload file'
    console.error('[chat-media] upload failed', {
      channelId,
      path: storagePath,
      name: (error as { name?: string }).name,
      statusCode: (error as { statusCode?: string | number }).statusCode,
      message
    })
    throw new Error(message)
  }

  return {
    path: storagePath,
    url: storagePath,
    type,
    name: file.name,
    size: file.size
  }
}
