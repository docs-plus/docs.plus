import { isDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/react'
import { clampToContainerFraction } from '@utils/clampToContainerFraction'
import { nudgeVirtualKeyboardOpenFromVisualViewport } from '@utils/virtualKeyboardMetrics'
import { syncVisualViewportToCssVars } from '@utils/visualViewportCss'
import { useCallback, useEffect } from 'react'

const SCROLL_MARGIN = 100
// One follow-up after keyboard animation; multiple delays felt like extra “nudges” vs double-tap.
const MOBILE_CARET_SCROLL_RETRY_MS = 300

// The store signal, not a width: a phone in landscape is wider than the mobile breakpoint.
const isMobile = (): boolean => Boolean(useStore.getState().settings.editor.isMobile)

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

const scrollCaretIntoView = (editor: Editor): void => {
  if (!editor?.view) return

  try {
    const view = editor.view
    const { from } = view.state.selection
    const coords = view.coordsAtPos(from)
    if (!coords) return

    const scrollContainer = getScrollContainer()
    if (!scrollContainer) {
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

    const margin = clampToContainerFraction(SCROLL_MARGIN, containerRect.height)
    const visibleTop = containerRect.top + margin
    // Mobile pad: toolbar is a flex sibling below the editor wrapper — don't subtract it again.
    const visibleBottom = inMobilePad
      ? containerRect.bottom - margin
      : containerRect.bottom - toolbarHeight - margin

    const caretY = coords.top
    // iOS: smooth scroll often stalls after repeated keyboard open/close; instant is reliable.
    const behavior: ScrollBehavior = isMobile() ? 'auto' : 'smooth'

    if (caretY > visibleBottom) {
      const scrollAmount = caretY - visibleBottom + margin
      scrollContainer.scrollBy({ top: scrollAmount, behavior })
    } else if (caretY < visibleTop) {
      const scrollAmount = caretY - visibleTop - margin
      scrollContainer.scrollBy({ top: scrollAmount, behavior })
    }
  } catch {
    // View might be destroyed, ignore
  }
}

const ensureCaretVisible = (editor: Editor): void => {
  if (!isMobile()) {
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

/**
 * Used by EditorContent (double-tap) and EditFAB (button tap).
 */
export const useEnableEditor = () => {
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)

  const enableEditor = useCallback(() => {
    const editor = useStore.getState().settings.editor.instance
    if (!editor) return false
    // Read-only enforcement / content-fork freeze disabled this editor on purpose;
    // both the EditFAB tap and the double-tap route here, so gate them together.
    if (isDocumentEditingLocked()) return false

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
  }, [isKeyboardOpen, setWorkspaceEditorSetting])

  /** Double-tap path: the caret already sits at the tap position. */
  const enableAndFocus = useCallback(() => {
    const editor = useStore.getState().settings.editor.instance
    if (!editor) return
    if (!enableEditor()) return
    editor.commands.focus()
    if (isMobile()) {
      scheduleMobileKeyboardNudgeAfterFocus()
    } else {
      ensureCaretVisible(editor)
    }
  }, [enableEditor])

  /** Button-tap path: nothing placed the caret, so set it explicitly. */
  const enableAndFocusAt = useCallback(
    (pos: number) => {
      const editor = useStore.getState().settings.editor.instance
      if (!editor) return
      if (!enableEditor()) return
      editor.chain().setTextSelection(pos).focus().run()
      if (isMobile()) {
        scheduleMobileKeyboardNudgeAfterFocus()
      } else {
        ensureCaretVisible(editor)
      }
    },
    [enableEditor]
  )

  const ensureVisible = useCallback(() => {
    const editor = useStore.getState().settings.editor.instance
    if (editor) ensureCaretVisible(editor)
  }, [])

  return {
    isKeyboardOpen,
    enableEditor,
    enableAndFocus,
    enableAndFocusAt,
    ensureVisible
  }
}

export const useEditorFocusScroll = () => {
  const editor = useStore((state) => state.settings.editor.instance)

  useEffect(() => {
    if (!editor || !isMobile()) return

    const handleFocus = () => {
      ensureCaretVisible(editor)
    }

    editor.on('focus', handleFocus)

    return () => {
      editor.off('focus', handleFocus)
    }
  }, [editor])
}
