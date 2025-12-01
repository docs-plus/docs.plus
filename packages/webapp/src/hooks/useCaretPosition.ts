import { useCallback, useEffect } from 'react'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/react'

// ============================================================================
// Constants
// ============================================================================

const MOBILE_BREAKPOINT = 768
const SCROLL_MARGIN = 100 // Extra margin for comfortable visibility
const KEYBOARD_RATIO = 0.45 // Estimated keyboard + toolbar takes ~45% of screen
// Timing for iOS keyboard animation + layout settling
const SCROLL_DELAYS = [150, 350] // Two attempts: after animation starts, after it settles

// ============================================================================
// Module-level state
// ============================================================================

let savedCaretPos: number | null = null

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
  return document.querySelector('.editorWrapper') as HTMLElement | null
}

/**
 * Get safe viewport bounds accounting for header, toolbar, keyboard, and scroll margin
 * @param expectKeyboard - If true, account for keyboard that will open
 */
const getViewportBounds = (expectKeyboard = false) => {
  const header = document.querySelector('.sticky.top-0') as HTMLElement
  const headerHeight = header?.getBoundingClientRect().height ?? 60

  // Use visualViewport if keyboard is already open
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight

  // If keyboard will open but isn't yet, estimate space it will take
  const estimatedKeyboardHeight = expectKeyboard ? window.innerHeight * KEYBOARD_RATIO : 0

  // Get actual toolbar height if visible
  const toolbar = document.querySelector('.mobileToolbarBottom') as HTMLElement
  const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0

  const top = headerHeight + SCROLL_MARGIN
  const bottom = viewportHeight - toolbarHeight - estimatedKeyboardHeight - SCROLL_MARGIN

  return {
    top,
    bottom: Math.max(bottom, top + 50), // Ensure minimum usable space
    center: (top + Math.max(bottom, top + 50)) / 2
  }
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
    const toolbar = document.querySelector('.mobileToolbarBottom') as HTMLElement
    const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0

    // Effective visible area within scroll container
    const visibleTop = containerRect.top + SCROLL_MARGIN
    const visibleBottom = containerRect.bottom - toolbarHeight - SCROLL_MARGIN

    const caretY = coords.top

    if (caretY > visibleBottom) {
      // Caret below visible area - scroll down
      const scrollAmount = caretY - visibleBottom + SCROLL_MARGIN
      scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' })
    } else if (caretY < visibleTop) {
      // Caret above visible area - scroll up
      const scrollAmount = caretY - visibleTop - SCROLL_MARGIN
      scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' })
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

  // Mobile: multiple attempts to handle iOS keyboard animation
  SCROLL_DELAYS.forEach((delay) => {
    setTimeout(() => scrollCaretIntoView(editor), delay)
  })
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for managing caret position in the editor.
 * - Saves caret position when keyboard closes
 * - Provides viewport-aware position calculation
 * - Ensures caret visibility with proper scroll handling
 */
export const useCaretPosition = () => {
  const { settings, isKeyboardOpen } = useStore()
  const { instance: editor } = settings.editor

  // Save caret position when keyboard closes
  useEffect(() => {
    if (!isKeyboardOpen && editor) {
      savedCaretPos = editor.state.selection.from
    }
  }, [isKeyboardOpen, editor])

  /**
   * Check if a document position is currently visible in the viewport
   */
  const isPositionInViewport = useCallback(
    (pos: number): boolean => {
      if (!editor) return false
      try {
        const coords = editor.view.coordsAtPos(pos)
        const bounds = getViewportBounds()
        return coords.top >= bounds.top && coords.top <= bounds.bottom
      } catch {
        return false
      }
    },
    [editor]
  )

  /**
   * Get document position at viewport center, snapped to word end
   * Accounts for keyboard that will open after focus
   */
  const getViewportCenterPos = useCallback((): number => {
    if (!editor) return 0

    // Calculate center accounting for keyboard that will open
    const bounds = getViewportBounds(true)
    const editorRect = editor.view.dom.getBoundingClientRect()

    const pos = editor.view.posAtCoords({
      left: editorRect.left + 20,
      top: bounds.center
    })

    if (!pos) return 0

    // Snap to end of word for cleaner caret placement
    const doc = editor.state.doc
    let targetPos = pos.pos
    const docSize = doc.content.size

    while (targetPos < docSize) {
      const char = doc.textBetween(targetPos, Math.min(targetPos + 1, docSize))
      if (!char || /\s|[.,!?;:]/.test(char)) break
      targetPos++
    }

    return targetPos
  }, [editor])

  /**
   * Get the best caret position:
   * - If saved position is visible → return it
   * - Otherwise → return viewport center position
   */
  const getTargetCaretPos = useCallback((): number => {
    if (savedCaretPos !== null && isPositionInViewport(savedCaretPos)) {
      return savedCaretPos
    }
    return getViewportCenterPos()
  }, [isPositionInViewport, getViewportCenterPos])

  return {
    editor,
    isKeyboardOpen,
    savedCaretPos,
    isPositionInViewport,
    getViewportCenterPos,
    getTargetCaretPos
  }
}

/**
 * Hook for enabling editor and focusing with smart caret visibility.
 * Used by EditorContent (double-tap) and EditFAB (button tap).
 */
export const useEnableEditor = () => {
  const { settings, isKeyboardOpen } = useStore()
  const { instance: editor } = settings.editor
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)

  /**
   * Enable editor for editing (contenteditable, etc.)
   */
  const enableEditor = useCallback(() => {
    if (!editor) return false
    if (isKeyboardOpen) return true // Already enabled

    const proseMirrorEl = document.querySelector('.tiptap.ProseMirror') as HTMLElement
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
    ensureCaretVisible(editor)
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
      ensureCaretVisible(editor)
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
  const { settings } = useStore()
  const { instance: editor } = settings.editor

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
