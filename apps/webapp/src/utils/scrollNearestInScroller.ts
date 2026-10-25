function closestVerticalScroller(el: Element): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
  }
  return null
}

/** Manual `block: 'nearest'` on the closest vertical scroller only. Chrome moves the sequential
 * focus starting point on `scrollIntoView`, so the first Tab skipped the skip link. */
export function scrollNearestInScroller(target: Element) {
  if (target.getClientRects().length === 0) return
  const scroller = closestVerticalScroller(target)
  if (!scroller) return

  const rect = target.getBoundingClientRect()
  const viewTop = scroller.getBoundingClientRect().top + scroller.clientTop
  const viewBottom = viewTop + scroller.clientHeight
  const above = rect.top < viewTop
  const below = rect.bottom > viewBottom
  if (above === below) return

  // Same edge pick as the CSSOM `nearest` rule, including targets taller than the scroller.
  const fitsInView = rect.height <= scroller.clientHeight
  const alignTop = above === fitsInView
  scroller.scrollTop += alignTop ? rect.top - viewTop : rect.bottom - viewBottom
}
