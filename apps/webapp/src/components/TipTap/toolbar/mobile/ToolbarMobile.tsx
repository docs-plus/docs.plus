import useReRenderOnEditorTransaction from '@hooks/useReRenderOnEditorTransaction'
import { Icons } from '@icons'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'
import { useSheetStore, useStore } from '@stores'
import React, { useEffect, useRef, useState } from 'react'

import { dismissSoftKeyboard } from '../../hyperlinkPopovers/previewHyperlink'
import ToolbarButton from '../ToolbarButton'
import FormatSelection from './FormatSelection'
import HeadingSelection from './HeadingSelection'

const FORMAT_PANEL_ID = 'mobile-format-panel'

/** Every main-row control is 44px to meet the mobile touch target; icons keep one optical weight. */
const MAIN_ROW_BTN = 'min-h-11 min-w-11 touch-manipulation'

/** Gap kept between the caret and the panel's top edge when auto-scrolling it into view. */
const CARET_BREATHING_PX = 20

const ToolbarMobile = () => {
  const [isFormatSelectionVisible, setIsFormatSelectionVisible] = useState(false)
  const editor = useStore((state) => state.settings.editor.instance)
  const isEditable = useStore((state) => state.settings.editor.isEditable)

  const { createComment } = useTurnSelectedTextIntoComment()
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)

  // Keep format-button is-active / aria-pressed live: the pad editor doesn't re-render this tree
  // on selection change, so without this the highlights go stale as the caret moves.
  useReRenderOnEditorTransaction(editor)

  // The panel lifts by its own height purely in CSS (`-translate-y-full`), so no measured state is
  // needed; these refs are read on demand below for the one-shot caret-scroll math.
  const mainRowRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditable) {
      setIsFormatSelectionVisible(false)
    }
  }, [isEditable])

  if (!editor || !isKeyboardOpen) return null

  const toggleFormatSelection = (event: React.TouchEvent | React.MouseEvent) => {
    event.stopPropagation()

    const willOpen = !isFormatSelectionVisible
    setIsFormatSelectionVisible(willOpen)

    if (willOpen) {
      requestAnimationFrame(() => {
        const editorWrapper = document.querySelector('.editorWrapper')
        const selection = window.getSelection()
        if (!editorWrapper || !selection?.rangeCount) return

        const range = selection.getRangeAt(0)
        const caretRect = range.getBoundingClientRect()
        const wrapperRect = editorWrapper.getBoundingClientRect()
        const obstructionPx =
          (panelRef.current?.offsetHeight ?? 0) + (mainRowRef.current?.offsetHeight ?? 0)
        const visibleBottom = wrapperRect.bottom - obstructionPx

        if (caretRect.bottom > visibleBottom) {
          editorWrapper.scrollTop += caretRect.bottom - visibleBottom + CARET_BREATHING_PX
        }
      })
    }
  }

  const stayFocused = (event: React.TouchEvent | React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    editor.view.focus()
  }

  return (
    <div
      className="tiptap-toolbar-mobile relative motion-safe:animate-[doc-content-in_180ms_ease-out_both]"
      onTouchEnd={stayFocused}>
      <FormatSelection
        rootRef={panelRef}
        id={FORMAT_PANEL_ID}
        isVisible={isFormatSelectionVisible}
        editor={editor}
      />
      <div
        ref={mainRowRef}
        className="tiptap-toolbar-mobile__main bg-base-100 relative z-10 flex h-14 items-center justify-around gap-1">
        <HeadingSelection editor={editor} />

        <ToolbarButton
          editor={editor}
          type="hyperlink"
          aria-label="Insert link"
          className={MAIN_ROW_BTN}
          onPress={(e) => {
            e.stopPropagation()
            editor.chain().focus().openCreateHyperlinkPopover().run()
          }}>
          <Icons.link size={24} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="image"
          aria-label="Insert image"
          className={MAIN_ROW_BTN}
          onPress={(e) => {
            e.stopPropagation()
            dismissSoftKeyboard(editor)
            useSheetStore.getState().openSheet('mediaInsert', { editor })
          }}>
          <Icons.image size={24} />
        </ToolbarButton>

        <ToolbarButton
          aria-label="Add comment"
          className={MAIN_ROW_BTN}
          onPress={(e) => {
            e.stopPropagation()
            createComment(editor)
          }}>
          <Icons.comment size={24} />
        </ToolbarButton>

        <ToolbarButton
          aria-label="Text formatting"
          aria-expanded={isFormatSelectionVisible}
          aria-controls={FORMAT_PANEL_ID}
          isActive={isFormatSelectionVisible}
          className={MAIN_ROW_BTN}
          onPress={toggleFormatSelection}>
          <Icons.textFormat size={26} />
        </ToolbarButton>
      </div>
    </div>
  )
}

export default ToolbarMobile
