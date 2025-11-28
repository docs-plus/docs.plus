import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Extension } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

/**
 * iOS Safari Caret Visibility Plugin
 *
 * Ensures the caret is scrolled into view within the editor container
 * after keyboard animation completes. Handles the case where tapping
 * on the bottom half of the screen causes the caret to be hidden.
 */

const MOBILE_BREAKPOINT = 768
// Timing for iOS keyboard animation + layout settling
const SCROLL_DELAYS = [100, 300, 400] // Multiple attempts for reliability
const SCROLL_MARGIN = 100 // Extra margin above caret for better visibility

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= MOBILE_BREAKPOINT
}

/**
 * Get the scroll container (editorWrapper)
 */
const getScrollContainer = (view: EditorView): HTMLElement | null => {
  // Find the editorWrapper - it's the scrollable parent of the editor
  let el: HTMLElement | null = view.dom as HTMLElement
  while (el) {
    if (el.classList.contains('editorWrapper')) {
      return el
    }
    el = el.parentElement
  }
  return null
}

/**
 * Scroll the caret into view within the editor container
 */
const scrollCaretIntoView = (view: EditorView): void => {
  try {
    // First, use ProseMirror's built-in scroll
    view.dispatch(view.state.tr.scrollIntoView())

    // Then, ensure the caret is actually visible in the scroll container
    const scrollContainer = getScrollContainer(view)
    if (!scrollContainer) return

    // Get caret position from selection
    const { from } = view.state.selection
    const coords = view.coordsAtPos(from)
    if (!coords) return

    const containerRect = scrollContainer.getBoundingClientRect()
    const caretTop = coords.top
    const caretBottom = coords.bottom

    // Check if caret is below visible area
    if (caretBottom > containerRect.bottom - SCROLL_MARGIN) {
      // Scroll down to show caret with margin
      const scrollAmount = caretBottom - containerRect.bottom + SCROLL_MARGIN
      scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' })
    }
    // Check if caret is above visible area
    else if (caretTop < containerRect.top + SCROLL_MARGIN) {
      // Scroll up to show caret with margin
      const scrollAmount = caretTop - containerRect.top - SCROLL_MARGIN
      scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' })
    }
  } catch {
    // View might be destroyed, ignore
  }
}

const handleFocus = (view: EditorView): void => {
  if (!isMobile()) return

  // Multiple scroll attempts at different timings for reliability
  // This handles various iOS keyboard animation timings
  SCROLL_DELAYS.forEach((delay) => {
    setTimeout(() => {
      scrollCaretIntoView(view)
    }, delay)
  })
}

export const createScrollCaretIntoViewPlugin = () => {
  return Extension.create({
    name: 'scrollCaretIntoView',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('scrollCaretIntoView'),

          props: {
            handleDOMEvents: {
              focus: (view) => {
                handleFocus(view)
                return false
              }
            }
          }
        })
      ]
    }
  })
}
