/** Calls `onVisible` once, when `target` first comes within 800px of the viewport. */
export function observeVisible(target: Element, onVisible: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    // No observer (jsdom, old browsers): treat the block as visible, or it never draws.
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) onVisible()
    })
    return () => {
      cancelled = true
    }
  }

  const observer = new IntersectionObserver(
    (records) => {
      if (!records.some((record) => record.isIntersecting)) return
      observer.disconnect()
      onVisible()
    },
    { rootMargin: '800px 0px' }
  )
  observer.observe(target)
  return () => observer.disconnect()
}
