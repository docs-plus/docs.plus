/** Two-tap spoiler gate for feed tiles and gallery slides. */

import { mediaKey } from '@components/chatroom/utils/galleryPlaylist'
import type { MessageMediaItem } from '@types'
import { type MouseEvent, useCallback, useSyncExternalStore } from 'react'

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

export const isFeedSpoilerRevealed = (media: MessageMediaItem): boolean =>
  getKeys().has(mediaKey(media))

export const markFeedSpoilerRevealed = (media: MessageMediaItem): void => {
  const key = mediaKey(media)
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

const useFeedSpoilerRevealed = (media: MessageMediaItem): boolean => {
  const key = mediaKey(media)
  return useSyncExternalStore(
    subscribe,
    () => getKeys().has(key),
    () => false
  )
}

export function useFeedSpoilerGate(media: MessageMediaItem) {
  const revealed = useFeedSpoilerRevealed(media)
  const isSpoiler = Boolean(media.spoiler) && !revealed

  const reveal = useCallback(() => {
    markFeedSpoilerRevealed(media)
  }, [media])

  return { isSpoiler, reveal }
}

type SpoilerGatedActivateOptions = {
  /** When false, skip activate after reveal (e.g. unsigned URL). Default true. */
  ready?: boolean
  preventDefault?: boolean
}

/** Reveal-first then activate — one activate path for all feed media tiles. */
export function useSpoilerGatedActivate(
  media: MessageMediaItem,
  activate: (() => void) | undefined,
  options?: SpoilerGatedActivateOptions
) {
  const { isSpoiler, reveal } = useFeedSpoilerGate(media)
  const ready = options?.ready ?? true
  const preventDefault = options?.preventDefault ?? false

  const onActivate = useCallback(
    (event: MouseEvent) => {
      if (preventDefault) event.preventDefault()
      event.stopPropagation()
      if (isSpoiler) {
        reveal()
        return
      }
      if (ready) activate?.()
    },
    [activate, isSpoiler, preventDefault, ready, reveal]
  )

  return { isSpoiler, reveal, onActivate }
}
