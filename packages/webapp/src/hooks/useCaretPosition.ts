import { useStore } from '@stores'
import type { Editor } from '@tiptap/react'
import { nudgeVirtualKeyboardOpenFromVisualViewport } from '@utils/virtualKeyboardMetrics'
import { syncVisualViewportToCssVars } from '@utils/visualViewportCss'
import { useCallback, useEffect } from 'react'

// ============================================================================
// Constants
// ============================================================================

const MOBILE_BREAKPOINT = 768
const SCROLL_MARGIN = 100 // Extra margin for comfortable visibility
// One follow-up after keyboard animation; multiple delays felt like extra “nudges” vs double-tap.
const MOBILE_CARET_SCROLL_RETRY_MS = 300

// ============================================================================
// Utility functions
// ============================================================================

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= MOBILE_BREAKPOINT
}

/**
 * Get the scroll container (editorWrapper)
 */
const getScrollContainer = (): HTMLElement | null => {
  return document.querySelector(
    '.mobileLayoutRoot .editor.editorWrapper, .editorWrapper'
  ) as HTMLElement | null
}

/**
 * After programmatic focus on mobile: sync vv CSS vars + refresh keyboard store (same as listener path).
 * `useEditorFocusScroll` owns `ensureCaretVisible` so we don’t double-scroll on focus.
 */
const scheduleMobileKeyboardNudgeAfterFocus = (): void => {
  syncVisualViewportToCssVars()
  nudgeVirtualKeyboardOpenFromVisualViewport()
  requestAnimationFrame(() => {
    syncVisualViewportToCssVars()
    nudgeVirtualKeyboardOpenFromVisualViewport()
    requestAnimationFrame(() => {
      nudgeVirtualKeyboardOpenFromVisualViewport()
    })
  })
}

/**
 * Scroll caret into visible area with proper margins
 */
const scrollCaretIntoView = (editor: Editor): void => {
  if (!editor?.view) return

  try {
    const view = editor.view
    const { from } = view.state.selection
    const coords = view.coordsAtPos(from)
    if (!coords) return

    const scrollContainer = getScrollContainer()
    if (!scrollContainer) {
      // Fallback to ProseMirror's built-in scroll
      view.dispatch(view.state.tr.scrollIntoView())
      return
    }

    const containerRect = scrollContainer.getBoundingClientRect()
    const inMobilePad = scrollContainer.closest('.mobileLayoutRoot') != null
    const toolbar = inMobilePad
      ? null
      : (document.querySelector(
          '.mobileLayoutRoot .mobileToolbarBottom, .mobileToolbarBottom'
        ) as HTMLElement)
    const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0

    // Effective visible area within scroll container
    const visibleTop = containerRect.top + SCROLL_MARGIN
    // Mobile pad: toolbar is a flex sibling below the editor wrapper — don't subtract it again.
    const visibleBottom = inMobilePad
      ? containerRect.bottom - SCROLL_MARGIN
      : containerRect.bottom - toolbarHeight - SCROLL_MARGIN

    const caretY = coords.top
    // iOS: smooth scroll often stalls after repeated keyboard open/close; instant is reliable.
    const behavior: ScrollBehavior = isMobile() ? 'auto' : 'smooth'

    if (caretY > visibleBottom) {
      // Caret below visible area - scroll down
      const scrollAmount = caretY - visibleBottom + SCROLL_MARGIN
      scrollContainer.scrollBy({ top: scrollAmount, behavior })
    } else if (caretY < visibleTop) {
      // Caret above visible area - scroll up
      const scrollAmount = caretY - visibleTop - SCROLL_MARGIN
      scrollContainer.scrollBy({ top: scrollAmount, behavior })
    }
  } catch {
    // View might be destroyed, ignore
  }
}

/**
 * Ensure caret is visible after focus, with delayed retries for iOS keyboard animation
 */
const ensureCaretVisible = (editor: Editor): void => {
  if (!isMobile()) {
    // Desktop: single immediate scroll
    scrollCaretIntoView(editor)
    return
  }

  syncVisualViewportToCssVars()
  // Wait two frames so WebKit applies flex + vv geometry before coordsAtPos / scroll.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollCaretIntoView(editor)
      setTimeout(() => scrollCaretIntoView(editor), MOBILE_CARET_SCROLL_RETRY_MS)
    })
  })
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for enabling editor and focusing with smart caret visibility.
 * Used by EditorContent (double-tap) and EditFAB (button tap).
 */
export const useEnableEditor = () => {
  const editor = useStore((state) => state.settings.editor.instance)
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)

  /**
   * Enable editor for editing (contenteditable, etc.)
   */
  const enableEditor = useCallback(() => {
    if (!editor) return false

    const proseMirrorEl = document.querySelector('.tiptap.ProseMirror') as HTMLElement
    if (isKeyboardOpen) {
      if (!useStore.getState().settings.editor.isEditable) {
        proseMirrorEl?.setAttribute('contenteditable', 'true')
        setWorkspaceEditorSetting('isEditable', true)
        editor.setEditable(true)
      }
      return true
    }

    proseMirrorEl?.setAttribute('contenteditable', 'true')
    setWorkspaceEditorSetting('isEditable', true)
    editor.setEditable(true)
    return true
  }, [editor, isKeyboardOpen, setWorkspaceEditorSetting])

  /**
   * Enable editor and focus (for double-tap - caret already at tap position)
   * Handles iOS keyboard animation with delayed scroll attempts
   */
  const enableAndFocus = useCallback(() => {
    if (!editor) return
    enableEditor()
    editor.commands.focus()
    if (isMobile()) {
      scheduleMobileKeyboardNudgeAfterFocus()
    } else {
      ensureCaretVisible(editor)
    }
  }, [editor, enableEditor])

  /**
   * Enable editor, set caret position, and focus (for button tap)
   * Handles iOS keyboard animation with delayed scroll attempts
   */
  const enableAndFocusAt = useCallback(
    (pos: number) => {
      if (!editor) return
      enableEditor()
      editor.chain().setTextSelection(pos).focus().run()
      if (isMobile()) {
        scheduleMobileKeyboardNudgeAfterFocus()
      } else {
        ensureCaretVisible(editor)
      }
    },
    [editor, enableEditor]
  )

  /**
   * Ensure caret is visible - can be called on any focus event
   */
  const ensureVisible = useCallback(() => {
    if (editor) ensureCaretVisible(editor)
  }, [editor])

  return {
    editor,
    isKeyboardOpen,
    enableEditor,
    enableAndFocus,
    enableAndFocusAt,
    ensureVisible
  }
}

/**
 * Hook to auto-scroll caret into view on editor focus.
 * Use this in components that render the editor.
 */
export const useEditorFocusScroll = () => {
  const editor = useStore((state) => state.settings.editor.instance)

  useEffect(() => {
    if (!editor || !isMobile()) return

    const handleFocus = () => {
      ensureCaretVisible(editor)
    }

    // Listen for focus events on the editor
    editor.on('focus', handleFocus)

    return () => {
      editor.off('focus', handleFocus)
    }
  }, [editor])
}
