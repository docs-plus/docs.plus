let scheduled = false
let loadPromise: Promise<unknown> | null = null
let dataPromise: Promise<unknown> | null = null

/** The one emoji data source. The picker reads it too, so emoji-mart never sees two sets. */
export const loadEmojiData = () =>
  (dataPromise ??= import('@emoji-mart/data')
    .then((module) => module.default)
    .catch((error) => {
      // A failed chunk load must not poison the cache — allow a later retry.
      dataPromise = null
      throw error
    }))

const load = () =>
  (loadPromise ??= Promise.all([import('emoji-mart'), loadEmojiData()])
    .then(([{ init }, data]) => init({ data }))
    .catch((error) => {
      loadPromise = null
      console.error('[emoji] init failed', error)
    }))

/**
 * Emoji data is ~600KB parsed — keep it off the page entry chunk. Every emoji-mart init
 * must pass the set from `loadEmojiData`, because an init with no data fetches a set from a CDN.
 * Chat-open paths pass `immediate` to skip the idle wait.
 */
export const ensureEmojiData = (immediate = false) => {
  if (typeof window === 'undefined') return
  if (immediate) {
    load()
    return
  }
  if (scheduled) return
  scheduled = true
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => load(), { timeout: 2000 })
  } else {
    setTimeout(load, 1)
  }
}
