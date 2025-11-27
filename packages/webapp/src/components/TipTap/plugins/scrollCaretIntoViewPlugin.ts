import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Extension } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

/**
 * iOS Safari Caret Visibility Plugin
 *
 * Simplified version - the CSS layout now handles keyboard viewport changes.
 * This plugin only ensures the caret is scrolled into view within the editor
 * container after keyboard animation completes.
 */

const MOBILE_BREAKPOINT = 768
const KEYBOARD_ANIMATION_DELAY = 400 // Wait for iOS keyboard animation

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= MOBILE_BREAKPOINT
}

const scrollCaretIntoView = (view: EditorView): void => {
  // Only scroll within the editor container, not the window
  // The editorWrapper handles its own scrolling
  view.dispatch(view.state.tr.scrollIntoView())
}

const handleFocus = (view: EditorView): void => {
  if (!isMobile()) return

  // Wait for keyboard animation to complete, then scroll caret into view
  setTimeout(() => {
    scrollCaretIntoView(view)
  }, KEYBOARD_ANIMATION_DELAY)
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
