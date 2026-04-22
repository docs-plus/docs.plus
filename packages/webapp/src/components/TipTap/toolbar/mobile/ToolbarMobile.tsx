import { Icons } from '@icons'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'
import { useStore } from '@stores'
import React, { useEffect, useState } from 'react'

import ToolbarButton from '../ToolbarButton'
import FormatSelection from './FormatSelection'
import HeadingSelection from './HeadingSelection'

/** Matches `FormatSelection` `-translate-y-[134px]` + `tiptap-toolbar-mobile__main` `h-14` (56px). */
const FORMAT_PANEL_LIFT_PX = 134
const TOOLBAR_MAIN_ROW_PX = 56

const ToolbarMobile = () => {
  const [isFormatSelectionVisible, setIsFormatSelectionVisible] = useState(false)
  const editor = useStore((state) => state.settings.editor.instance)
  const isEditable = useStore((state) => state.settings.editor.isEditable)

  const { createComment } = useTurnSelectedTextIntoComment()
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)

  useEffect(() => {
    if (isEditable) {
      setIsFormatSelectionVisible(false)
    }
  }, [isEditable])

  if (!editor || !isKeyboardOpen) return null

  const toggleFormatSelection = (event: React.TouchEvent | React.MouseEvent) => {
    event.preventDefault()
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
        const obstructionPx = FORMAT_PANEL_LIFT_PX + TOOLBAR_MAIN_ROW_PX
        const visibleBottom = wrapperRect.bottom - obstructionPx

        if (caretRect.bottom > visibleBottom) {
          editorWrapper.scrollTop += caretRect.bottom - visibleBottom + 20
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
    <div className="tiptap-toolbar-mobile relative" onTouchEnd={stayFocused}>
      <FormatSelection isVisible={isFormatSelectionVisible} editor={editor} />
      <div className="tiptap-toolbar-mobile__main bg-base-100 relative z-10 flex h-14 items-center justify-around gap-1">
        <HeadingSelection editor={editor} />

        <ToolbarButton
          editor={editor}
          type="hyperlink"
          onTouchEnd={(e) => {
            e.preventDefault()
            e.stopPropagation()
            editor.chain().focus().openCreateHyperlinkPopover().run()
          }}>
          <Icons.link size={26} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="image"
          onTouchEnd={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const chain = editor.chain().focus() as unknown as {
              addImage: () => { run: () => boolean }
            }
            chain.addImage().run()
          }}>
          <Icons.image size={24} />
        </ToolbarButton>

        <ToolbarButton
          onTouchEnd={(e) => {
            e.preventDefault()
            e.stopPropagation()
            createComment(editor)
          }}>
          <Icons.thread size={24} />
        </ToolbarButton>

        <ToolbarButton isActive={isFormatSelectionVisible} onTouchEnd={toggleFormatSelection}>
          <Icons.textFormat size={30} />
        </ToolbarButton>
      </div>
    </div>
  )
}

export default ToolbarMobile
