import type { ComposerAttachment } from '@components/chatroom/stores/composerAttachmentsStore'
import {
  CHAT_MEDIA_MAX_CONCURRENT_UPLOADS,
  mediaStoragePath
} from '@components/chatroom/utils/messageMediaPaths'
import {
  deleteChatMediaFromStorage,
  uploadChatMedia
} from '@components/chatroom/utils/uploadChatMedia'

const MAX_EDGE_PX = 2048
const MIN_BYTES_TO_PROCESS = 512 * 1024
const JPEG_QUALITY = 0.82
const SKIP_IMAGE_TYPES = new Set(['image/gif', 'image/heic', 'image/heif'])

async function downscaleChatMediaImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || SKIP_IMAGE_TYPES.has(file.type)) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const maxDim = Math.max(bitmap.width, bitmap.height)
  const needsResize = maxDim > MAX_EDGE_PX
  const needsCompress = file.size > MIN_BYTES_TO_PROCESS

  if (!needsResize && !needsCompress) {
    bitmap.close()
    return file
  }

  const scale = needsResize ? MAX_EDGE_PX / maxDim : 1
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const outputType =
    file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg'
  const quality = outputType === 'image/jpeg' ? JPEG_QUALITY : undefined

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, quality)
  })

  if (!blob || blob.size >= file.size) return file

  const ext = outputType === 'image/png' ? '.png' : outputType === 'image/webp' ? '.webp' : '.jpg'
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'

  return new File([blob], `${baseName}${ext}`, {
    type: outputType,
    lastModified: Date.now()
  })
}

type UploadRunnerContext = {
  userId: string
  channelId: string
  setAttachments: (
    next: ComposerAttachment[] | ((prev: ComposerAttachment[]) => ComposerAttachment[])
  ) => void
}

const isUploadCancelled = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export class ChatMediaUploadRunner {
  private activeIds = new Set<string>()
  private abortControllers = new Map<string, AbortController>()
  private pendingQueue: Array<{ id: string; file: File }> = []
  private activeUploads = 0
  private progressPending = new Map<string, number>()
  private progressFrame: number | null = null

  constructor(private readonly ctx: UploadRunnerContext) {}

  reset() {
    for (const controller of this.abortControllers.values()) controller.abort()
    this.abortControllers.clear()
    this.activeIds.clear()
    this.pendingQueue = []
    this.activeUploads = 0
    this.progressPending.clear()
    if (this.progressFrame != null) {
      cancelAnimationFrame(this.progressFrame)
      this.progressFrame = null
    }
  }

  dispose() {
    this.reset()
  }

  enqueue(id: string, file: File) {
    this.pendingQueue.push({ id, file })
    this.pump()
  }

  cancel(id: string) {
    this.activeIds.delete(id)
    this.abortControllers.get(id)?.abort()
    this.abortControllers.delete(id)
  }

  deleteReadyAttachment(
    attachment: ComposerAttachment,
    onPersistedRemoved: (path: string) => void
  ) {
    if (attachment.item && attachment.status === 'ready') {
      if (attachment.persisted) {
        const path = mediaStoragePath(attachment.item)
        if (path) onPersistedRemoved(path)
      } else {
        void deleteChatMediaFromStorage(attachment.item)
      }
    }
    this.cancel(attachment.id)
  }

  private flushProgress = () => {
    this.progressFrame = null
    const pending = new Map(this.progressPending)
    this.progressPending.clear()
    if (pending.size === 0) return

    this.ctx.setAttachments((prev) =>
      prev.map((attachment) => {
        const progress = pending.get(attachment.id)
        return progress != null && attachment.status === 'uploading'
          ? { ...attachment, progress }
          : attachment
      })
    )
  }

  private scheduleProgress(id: string, progress: number) {
    this.progressPending.set(id, progress)
    if (this.progressFrame != null) return
    this.progressFrame = requestAnimationFrame(this.flushProgress)
  }

  private pump = () => {
    while (this.activeUploads < CHAT_MEDIA_MAX_CONCURRENT_UPLOADS && this.pendingQueue.length > 0) {
      const next = this.pendingQueue.shift()
      if (!next) break
      this.activeUploads += 1
      void this.beginUpload(next.id, next.file).finally(() => {
        this.activeUploads -= 1
        this.pump()
      })
    }
  }

  private beginUpload(id: string, file: File): Promise<void> {
    this.abortControllers.get(id)?.abort()
    const controller = new AbortController()
    this.abortControllers.set(id, controller)
    this.activeIds.add(id)

    this.ctx.setAttachments((prev) => {
      const exists = prev.some((attachment) => attachment.id === id)
      if (exists) {
        return prev.map((attachment) =>
          attachment.id === id
            ? {
                ...attachment,
                file,
                status: 'uploading',
                progress: 0,
                error: undefined,
                item: undefined
              }
            : attachment
        )
      }
      return [...prev, { id, file, status: 'uploading', progress: 0 }]
    })

    return downscaleChatMediaImage(file)
      .then((uploadFile) =>
        uploadChatMedia(uploadFile, this.ctx.userId, this.ctx.channelId, {
          signal: controller.signal,
          onProgress: (progress) => {
            if (!this.activeIds.has(id)) return
            this.scheduleProgress(id, progress)
          }
        })
      )
      .then((item) => {
        if (!this.activeIds.has(id)) return
        this.abortControllers.delete(id)
        this.ctx.setAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === id
              ? { ...attachment, item, status: 'ready', progress: 100, error: undefined }
              : attachment
          )
        )
      })
      .catch((error: unknown) => {
        this.abortControllers.delete(id)
        if (!this.activeIds.has(id) || isUploadCancelled(error)) return
        const message = error instanceof Error ? error.message : 'Failed to upload file'
        this.ctx.setAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === id
              ? { ...attachment, status: 'error', error: message, progress: undefined }
              : attachment
          )
        )
      })
  }
}
