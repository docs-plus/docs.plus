import {
  resolveMediaDisplayUrl,
  resolveMediaDownloadUrl
} from '@components/chatroom/utils/chatMediaUrl'
import * as toast from '@components/toast'
import type { MessageMediaItem } from '@types'
import { copyToClipboard } from '@utils/clipboard'

const isHttpUrl = (url: string): boolean => url.startsWith('http://') || url.startsWith('https://')

const isIosSafari = (): boolean => /iPad|iPhone|iPod/.test(navigator.userAgent)

const canShareFiles = (files: File[]): boolean =>
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files })

const isShareAbort = (err: unknown): boolean => err instanceof Error && err.name === 'AbortError'

const defaultFileName = (media: MessageMediaItem): string => media.name?.trim() || 'attachment'

async function fetchMediaBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.blob()
  } catch {
    return null
  }
}

function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type || 'application/octet-stream' })
}

async function resolveActiveMediaUrl(media: MessageMediaItem): Promise<string | null> {
  const url = await resolveMediaDisplayUrl(media)
  if (!url?.trim() || !isHttpUrl(url)) return null
  return url
}

export async function copyResolvedMediaLink(url: string | null | undefined): Promise<boolean> {
  if (!url?.trim() || !isHttpUrl(url)) {
    toast.Error('Media link unavailable')
    return false
  }

  const success = await copyToClipboard(url)
  if (success) {
    toast.Success('Media link copied')
  } else {
    toast.Error('Failed to copy media link')
  }
  return success
}

export function openResolvedMediaLink(url: string | null | undefined): boolean {
  if (!url?.trim() || !isHttpUrl(url)) {
    toast.Error('Media unavailable')
    return false
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    toast.Error('Media unavailable')
    return false
  }

  toast.Success('Opened in browser')
  return true
}

export async function copyMediaImage(
  media: MessageMediaItem,
  resolvedUrl?: string | null
): Promise<boolean> {
  if (media.type !== 'image') return false
  const url =
    resolvedUrl?.trim() && isHttpUrl(resolvedUrl) ? resolvedUrl : await resolveActiveMediaUrl(media)
  if (!url) {
    toast.Error('Image unavailable')
    return false
  }

  const blob = await fetchMediaBlob(url)
  if (!blob) {
    toast.Error('Failed to copy image')
    return false
  }

  const file = blobToFile(blob, media.name?.trim() || 'image.png')

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const mimeType = blob.type || 'image/png'
      await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })])
      toast.Success('Image copied')
      return true
    } catch {
      // Clipboard blocked — try share on mobile.
    }
  }

  if (canShareFiles([file])) {
    try {
      await navigator.share({ files: [file] })
      toast.Success('Image shared')
      return true
    } catch (err) {
      if (isShareAbort(err)) return false
    }
  }

  toast.Error('Copy not supported — use Share or Save instead')
  return false
}

export async function saveMediaFile(media: MessageMediaItem): Promise<boolean> {
  const url = await resolveMediaDownloadUrl(media)
  if (!url) {
    toast.Error('Media unavailable')
    return false
  }

  if (isIosSafari()) {
    const blob = await fetchMediaBlob(url)
    if (!blob) {
      toast.Error('Media unavailable')
      return false
    }

    const file = blobToFile(blob, defaultFileName(media))
    if (canShareFiles([file])) {
      try {
        await navigator.share({ files: [file] })
        toast.Success('Shared — choose Save to Files')
        return true
      } catch (err) {
        if (isShareAbort(err)) return false
      }
    }

    window.open(url, '_blank', 'noopener,noreferrer')
    toast.Info('Opened in browser — use Share to save')
    return true
  }

  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = defaultFileName(media)
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    toast.Success('Download started')
    return true
  } catch {
    toast.Error('Download failed')
    return false
  }
}
