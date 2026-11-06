import { scrollElementInMobilePadEditor } from './scrollMobilePadEditor'

export type ScrollToHeadingOptions = {
  behavior?: ScrollBehavior
  /** Mobile pad helper only implements start|nearest; desktop uses native scrollIntoView. */
  block?: 'start' | 'nearest'
  /** Runs once, when the heading has landed or the reader took over the scroll. */
  onSettled?: () => void
}

/** UniqueID also stamps `data-toc-id` on non-headings — keep scroll on heading nodes only. */
const HEADING_WITH_TOC_ID = ':is(h1,h2,h3,h4,h5,h6)[data-toc-id]'

/** No scroll event for this long means the scroll has stopped. */
const SETTLE_IDLE_MS = 150
/** Above the mobile helper's 12px top pad. */
const LAND_TOLERANCE_PX = 16
const MAX_CORRECTIONS = 3
const LANDING_MAX_MS = 3000
const READER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

let activeLanding: { cancel: () => void; finish: () => void } | null = null

function escapeAttr(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function scrollHeading(
  heading: Element,
  behavior: ScrollBehavior,
  block: 'start' | 'nearest'
): void {
  if (!scrollElementInMobilePadEditor(heading, { behavior, block })) {
    heading.scrollIntoView({ behavior, block, inline: 'nearest' })
  }
}

/**
 * A smooth scroll fixes its target at the start. Lazy media and diagrams that render on
 * the way push the heading down, so it lands short. Re-check once the scroll stops and
 * jump the rest. `instant`, because the pad scroller is `scroll-smooth`.
 */
function landOnHeading(heading: Element, scroller: HTMLElement, onSettled?: () => void): void {
  let corrections = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  const cleanup = () => {
    clearTimeout(idleTimer)
    clearTimeout(capTimer)
    scroller.removeEventListener('scroll', waitForIdle)
    for (const type of READER_INPUT) window.removeEventListener(type, finish, true)
    activeLanding = null
  }
  const finish = () => {
    cleanup()
    onSettled?.()
  }
  const check = () => {
    if (!heading.isConnected) return finish()
    const offset = heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    const maxTop = scroller.scrollHeight - scroller.clientHeight
    const canMove =
      offset > LAND_TOLERANCE_PX
        ? scroller.scrollTop < maxTop - 1
        : offset < -LAND_TOLERANCE_PX && scroller.scrollTop > 0
    if (!canMove || corrections >= MAX_CORRECTIONS) return finish()
    corrections++
    const before = scroller.scrollTop
    scrollHeading(heading, 'instant', 'start')
    if (scroller.scrollTop === before) return finish()
    waitForIdle()
  }
  function waitForIdle() {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(check, SETTLE_IDLE_MS)
  }
  const capTimer = setTimeout(finish, LANDING_MAX_MS)

  scroller.addEventListener('scroll', waitForIdle, { passive: true })
  // The reader's own scroll wins. Our scroll fires `scroll`, so listen for input instead.
  for (const type of READER_INPUT) {
    window.addEventListener(type, finish, { capture: true, passive: true })
  }
  activeLanding = { cancel: cleanup, finish }
  waitForIdle()
}

/** Pad DOM scroll only — never URL or CHAT_OPEN. Default block is nearest. */
export function scrollToHeading(headingId: string, options: ScrollToHeadingOptions = {}): void {
  const { behavior = 'smooth', block = 'nearest', onSettled } = options
  // A newer TOC scroll owns the new spy lock, so the old landing stops silently.
  // Any other scroll finishes it, so the old lock does not outlive it.
  if (onSettled) activeLanding?.cancel()
  else activeLanding?.finish()
  const headingSection = document.querySelector(
    `.ProseMirror ${HEADING_WITH_TOC_ID}[data-toc-id="${escapeAttr(headingId)}"]`
  )
  if (!headingSection) {
    onSettled?.()
    return
  }
  const scroller = headingSection.closest<HTMLElement>('.editorWrapper')
  scrollHeading(headingSection, behavior, block)
  if (block === 'start' && scroller) landOnHeading(headingSection, scroller, onSettled)
  else onSettled?.()
}
