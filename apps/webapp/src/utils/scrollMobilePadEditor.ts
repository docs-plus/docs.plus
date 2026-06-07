/**
 * Mobile document pad: scroll targets inside `.editorWrapper` only.
 * Native `Element.scrollIntoView()` on iOS Safari often scrolls the layout viewport / wrong
 * ancestors alongside the editor, which fights `position: fixed` + visualViewport CSS vars and
 * can hide `.mobilePadTitleShell` or misplace the caret.
 */
const EDITOR_WRAPPER_SEL = '.mobileLayoutRoot .editor.editorWrapper'

export function isMobileDocumentPadLayout(): boolean {
  return typeof document !== 'undefined' && document.querySelector('.mobileLayoutRoot') !== null
}

/**
 * Scroll `element` within the pad editor wrapper. Returns true if handled (caller skips native scrollIntoView).
 */
export function scrollElementInMobilePadEditor(
  element: Element,
  options: { block?: 'start' | 'nearest'; behavior?: ScrollBehavior } = {}
): boolean {
  if (!isMobileDocumentPadLayout()) return false

  const wrapper = document.querySelector(EDITOR_WRAPPER_SEL) as HTMLElement | null
  const root = document.querySelector('.mobileLayoutRoot')
  if (!wrapper || !root?.contains(element)) return false

  const block = options.block ?? 'nearest'
  // Mobile pad only: match scrollCaretIntoView (instant scroll avoids iOS smooth-scroll stalls).
  const behavior = options.behavior ?? 'auto'
  const padY = 12

  const wrapperRect = wrapper.getBoundingClientRect()
  const elRect = element.getBoundingClientRect()

  const visibleTop = wrapperRect.top + padY
  const visibleBottom = wrapperRect.bottom - padY

  let nextTop = wrapper.scrollTop

  if (block === 'start') {
    nextTop += elRect.top - wrapperRect.top - padY
  } else if (elRect.bottom > visibleBottom) {
    nextTop += elRect.bottom - visibleBottom + padY
  } else if (elRect.top < visibleTop) {
    nextTop += elRect.top - visibleTop - padY
  }

  if (nextTop !== wrapper.scrollTop) {
    wrapper.scrollTo({ top: nextTop, behavior })
  }

  return true
}
