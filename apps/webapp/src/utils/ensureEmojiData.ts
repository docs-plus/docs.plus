let scheduled = false
let loadPromise: Promise<unknown> | null = null

const load = () =>
  (loadPromise ??= Promise.all([import('emoji-mart'), import('@emoji-mart/data')])
    .then(([{ init }, data]) => init({ data: data.default }))
    .catch((error) => {
      // A failed chunk load must not poison the cache — allow a later retry.
      loadPromise = null
      console.error('[emoji] init failed', error)
    }))

/**
 * Emoji data is ~600KB parsed — keep it off the page entry chunk. Must be the FIRST
 * init emoji-mart sees, or its components self-initialize from a CDN fetch; chat-open
 * paths pass `immediate` to skip the idle wait.
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
