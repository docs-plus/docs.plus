import { mediaKey } from '@components/chatroom/utils/galleryPlaylist'
import type { MessageMediaItem } from '@types'
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const revealedKeys = new Set<string>()

const getKeys = (): Set<string> => revealedKeys

const emit = (): void => {
  listeners.forEach((listener) => listener())
}

const subscribe = (onStoreChange: () => void): (() => void) => {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

export const feedSpoilerRevealKey = (media: MessageMediaItem): string => mediaKey(media)

export const isFeedSpoilerRevealed = (media: MessageMediaItem): boolean =>
  getKeys().has(feedSpoilerRevealKey(media))

export const markFeedSpoilerRevealed = (media: MessageMediaItem): void => {
  const key = feedSpoilerRevealKey(media)
  const keys = getKeys()
  if (keys.has(key)) return
  keys.add(key)
  emit()
}

/** E2E isolation — module state survives Virtuoso remounts within a run. */
export const clearFeedSpoilerReveal = (): void => {
  const keys = getKeys()
  if (keys.size === 0) return
  keys.clear()
  emit()
}

export const useFeedSpoilerRevealed = (media: MessageMediaItem): boolean => {
  const key = feedSpoilerRevealKey(media)
  return useSyncExternalStore(
    subscribe,
    () => getKeys().has(key),
    () => false
  )
}
