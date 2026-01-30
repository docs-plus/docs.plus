import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@types'

/**
 * iOS Safari Caret Positioning Fix
 *
 * iOS Safari has a bug where tapping in the middle of a word often places
 * the caret at word boundaries instead of the exact tap position.
 * This plugin captures touch coordinates and corrects the caret position.
 */

const isIOSSafari = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua)
  return isIOS && isSafari
}

// Store touch coordinates from touchstart (more accurate than click on iOS)
let lastTouchCoords: { x: number; y: number } | null = null

const handleTouchStart = (view: EditorView, event: TouchEvent): boolean => {
  const touch = event.touches[0]
  if (touch) {
    lastTouchCoords = { x: touch.clientX, y: touch.clientY }
  }
  return false
}

const handleTouchEnd = (_view: EditorView, _event: TouchEvent): boolean => {
  // Just let the event propagate, click will handle the fix
  return false
}

const handleClick = (view: EditorView, event: MouseEvent): boolean => {
  // Only apply fix for iOS Safari
  if (!isIOSSafari()) {
    lastTouchCoords = null
    return false
  }

  // Use touchstart coordinates (more accurate on iOS)
  const coords = lastTouchCoords || { x: event.clientX, y: event.clientY }

  // Get position at tap coordinates
  const pos = view.posAtCoords({ left: coords.x, top: coords.y })

  if (!pos) {
    lastTouchCoords = null
    return false
  }

  // Use requestAnimationFrame for fastest possible correction after iOS places caret
  requestAnimationFrame(() => {
    const currentSelection = view.state.selection

    // Only fix collapsed selections (caret, not range)
    if (currentSelection.from !== currentSelection.to) {
      return
    }

    // Check if iOS placed caret in wrong position
    if (pos.pos !== currentSelection.from) {
      try {
        const selection = TextSelection.create(view.state.doc, pos.pos)
        const tr = view.state.tr.setSelection(selection)
        view.dispatch(tr)
      } catch {
        // Position might be invalid, ignore
      }
    }
  })

  lastTouchCoords = null
  return false // Let the event propagate normally
}

/**
 * iOS Caret Fix Extension
 */
export const IOSCaretFix = Extension.create({
  name: 'iosCaretFix',

  onCreate() {
    if (isIOSSafari()) {
      console.info('[iOS Caret Fix] Active')
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('iosCaretFix'),
        props: {
          handleDOMEvents: {
            touchstart: handleTouchStart,
            touchend: handleTouchEnd,
            click: handleClick
          }
        }
      })
    ]
  }
})

// Factory function for backwards compatibility
export const createIOSCaretFixPlugin = () => IOSCaretFix
