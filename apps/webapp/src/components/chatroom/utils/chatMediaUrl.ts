import {
  CHAT_MEDIA_BUCKET,
  CHAT_MEDIA_SIGNED_URL_TTL_SEC,
  mediaStoragePath
} from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem } from '@types'
import { supabaseClient } from '@utils/supabase'

const CACHE_BUFFER_MS = 60_000
const SIGNED_URL_CACHE_MAX = 256
const DOWNLOAD_STAGGER_MS = 250

type CacheEntry = { url: string; expiresAt: number }

const signedUrlCache = new Map<string, CacheEntry>()

const trimSignedUrlCache = () => {
  if (signedUrlCache.size <= SIGNED_URL_CACHE_MAX) return
  const overflow = signedUrlCache.size - SIGNED_URL_CACHE_MAX
  const keys = signedUrlCache.keys()
  for (let i = 0; i < overflow; i++) {
    const next = keys.next()
    if (next.done) break
    signedUrlCache.delete(next.value)
  }
}

export function invalidateSignedUrlCache(path: string): void {
  signedUrlCache.delete(path)
}

export async function resolveMediaDisplayUrl(media: MessageMediaItem): Promise<string> {
  const path = mediaStoragePath(media)
  if (!path) return media.url

  if (
    media.url.startsWith('http') &&
    !media.url.includes('/object/sign/') &&
    media.url.includes('/object/public/')
  ) {
    return media.url
  }

  const cached = signedUrlCache.get(path)
  if (cached && cached.expiresAt > Date.now() + CACHE_BUFFER_MS) {
    return cached.url
  }

  const { data, error } = await supabaseClient.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, CHAT_MEDIA_SIGNED_URL_TTL_SEC)

  if (error || !data?.signedUrl) {
    signedUrlCache.delete(path)
    console.warn('[chat-media] signed URL failed', {
      path,
      type: media.type,
      message: error?.message
    })
    if (
      media.url.startsWith('http://') ||
      media.url.startsWith('https://') ||
      media.url.startsWith('data:') ||
      media.url.startsWith('blob:')
    ) {
      return media.url
    }
    return ''
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + CHAT_MEDIA_SIGNED_URL_TTL_SEC * 1000
  })
  trimSignedUrlCache()
  return data.signedUrl
}

/**
 * Download-intent URL: signs with `download` so Storage returns Content-Disposition:
 * attachment, which forces a save even cross-origin. Kept separate from
 * resolveMediaDisplayUrl, which must stay inline for <audio>/<video>/<img> playback.
 */
export async function resolveMediaDownloadUrl(media: MessageMediaItem): Promise<string> {
  const path = mediaStoragePath(media)
  if (!path) return media.url

  const { data, error } = await supabaseClient.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, CHAT_MEDIA_SIGNED_URL_TTL_SEC, {
      download: media.name?.trim() || true
    })

  if (error || !data?.signedUrl) {
    console.warn('[chat-media] download URL failed', {
      path,
      type: media.type,
      message: error?.message
    })
    return media.url.startsWith('http') ? media.url : ''
  }

  return data.signedUrl
}

export async function downloadAllChatMedia(medias: MessageMediaItem[]): Promise<number> {
  let count = 0

  for (const media of medias) {
    const url = await resolveMediaDownloadUrl(media)
    if (!url) continue

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = media.name?.trim() || 'attachment'
    anchor.rel = 'noopener noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    count += 1

    if (count < medias.length) {
      await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_STAGGER_MS))
    }
  }

  return count
}
