import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Extension } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

/**
 * iOS Safari Caret Visibility Plugin
 *
 * Fixes invisible caret issue on iOS Safari by scrolling caret into view
 * after keyboard animation completes. Uses sequenced position lock + scroll
 * to prevent visual glitches.
 */

const MOBILE_BREAKPOINT = 768
const KEYBOARD_ANIMATION_DELAY = 350
const POSITION_SETTLE_DELAY = 50
const SCROLL_COMPLETE_DELAY = 100
const SCROLL_HACK_DELAY = 50
const POSITION_CSS_VAR = '--app-position_b'

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= MOBILE_BREAKPOINT
}

const setPosition = (value: 'fixed' | 'initial'): void => {
  document.documentElement.style.setProperty(POSITION_CSS_VAR, value)
}

const getPageTop = (): number => {
  const viewport = window.visualViewport
  return viewport ? Math.round(viewport.pageTop) : window.scrollY
}

const forceRepaint = (element: HTMLElement): void => {
  element.style.transform = 'translateZ(0)'
  void element.offsetHeight // Force reflow
  element.style.transform = ''
}

const scrollCaretIntoView = async (view: EditorView): Promise<void> => {
  const prosemirror = view.dom

  // Lock position to prevent visual glitches
  setPosition('fixed')
  await delay(POSITION_SETTLE_DELAY)

  // Reset scroll for iOS coordinate fix
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  await delay(POSITION_SETTLE_DELAY)

  // Scroll caret into view (position is locked, no glitch)
  view.dispatch(view.state.tr.scrollIntoView())
  await delay(SCROLL_COMPLETE_DELAY)

  // Force repaint to ensure caret renders
  if (prosemirror instanceof HTMLElement) {
    forceRepaint(prosemirror)
  }

  // Set final position state based on scroll position
  const pageTop = getPageTop()
  if (pageTop === 0) {
    setPosition('fixed')
  } else {
    setPosition('initial')
    await delay(SCROLL_HACK_DELAY)
    window.scrollTo({ top: 1, left: 0, behavior: 'instant' })
  }
}

const handleFocus = (view: EditorView): void => {
  if (!isMobile()) return

  delay(KEYBOARD_ANIMATION_DELAY)
    .then(() => scrollCaretIntoView(view))
    .catch((error) => {
      console.error('[iOS Caret Plugin] Error scrolling caret into view:', error)
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

