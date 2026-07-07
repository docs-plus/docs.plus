import {
  invalidateSignedUrlCache,
  resolveMediaDisplayUrl
} from '@components/chatroom/utils/chatMediaUrl'
import { mediaStoragePath } from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem } from '@types'
import { useCallback, useEffect, useState } from 'react'

export function useMediaDisplayUrl(media: MessageMediaItem | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!media) {
      setUrl(null)
      return
    }

    let cancelled = false
    void resolveMediaDisplayUrl(media).then((resolved) => {
      if (!cancelled) setUrl(resolved || null)
    })

    return () => {
      cancelled = true
    }
  }, [media, media?.path, media?.url, media?.type])

  return url
}

type FeedMediaUrlOptions = {
  rootMargin?: string
  /** Skip viewport gating for hosts already on screen (e.g. lightbox slides). */
  eager?: boolean
}

/** Signs chat media only after the host element enters (or nears) the viewport. */
export function useFeedMediaDisplayUrl(
  media: MessageMediaItem | null | undefined,
  options: FeedMediaUrlOptions = {}
): {
  url: string | null
  ref: React.RefCallback<HTMLElement>
  signFailed: boolean
  retry: () => void
} {
  const eager = options.eager ?? false
  const [url, setUrl] = useState<string | null>(null)
  const [signFailed, setSignFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [inView, setInView] = useState(eager)
  const [observeTarget, setObserveTarget] = useState<HTMLElement | null>(null)
  const rootMargin = options.rootMargin ?? '240px'

  // Stable identity: a fresh ref callback each render makes React detach/reattach,
  // tearing down and recreating the IntersectionObserver on every feed tile.
  const ref = useCallback<React.RefCallback<HTMLElement>>((node) => {
    setObserveTarget(node)
  }, [])

  const retry = useCallback(() => {
    const path = media ? mediaStoragePath(media) : null
    if (path) invalidateSignedUrlCache(path)
    setSignFailed(false)
    setAttempt((count) => count + 1)
  }, [media])

  useEffect(() => {
    if (eager) {
      setInView(true)
    } else {
      setInView(false)
    }
    setUrl(null)
    setSignFailed(false)
  }, [media?.path, media?.url, media?.type, eager])

  useEffect(() => {
    if (eager) return
    if (!observeTarget || !media) {
      setInView(false)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true)
      },
      { rootMargin, threshold: 0 }
    )
    observer.observe(observeTarget)
    return () => observer.disconnect()
  }, [observeTarget, media, rootMargin, eager])

  useEffect(() => {
    if (!media || (!eager && !inView)) return

    let cancelled = false
    void resolveMediaDisplayUrl(media).then((resolved) => {
      if (cancelled) return
      const path = mediaStoragePath(media)
      if (resolved) {
        setUrl(resolved)
        setSignFailed(false)
      } else {
        setUrl(null)
        setSignFailed(Boolean(path))
      }
    })

    return () => {
      cancelled = true
    }
  }, [inView, media, attempt, eager])

  return { url, ref, signFailed, retry }
}
