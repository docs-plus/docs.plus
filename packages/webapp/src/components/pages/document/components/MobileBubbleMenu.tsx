import { useClipboard } from '@pages/document/hooks'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'
import { useStore } from '@stores'
import { BubbleMenu } from '@tiptap/react/menus'
import { MouseEvent,TouchEvent, useCallback } from 'react'
import {
  MdContentCopy,
  MdContentCut,
  MdContentPaste,
  MdInsertLink,
  MdOutlineComment} from 'react-icons/md'

export const MobileBubbleMenu = () => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const { createComment } = useTurnSelectedTextIntoComment()
  const { cut, copy, paste, copied } = useClipboard(editor)

  // Prevent scroll behavior on button interactions
  const preventScrollAndRun = useCallback(
    (handler: () => void) => (e: TouchEvent | MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handler()
    },
    []
  )

  const handleComment = useCallback(() => {
    if (!editor) return
    createComment(editor)
  }, [editor, createComment])

  const handleLink = useCallback(() => {
    if (!editor) return
    // @ts-ignore - setHyperlink is a valid command
    editor.chain().focus().setHyperlink().run()
  }, [editor])

  if (!editor) return null

  return (
    <BubbleMenu
      className="mobile-bubble-menu"
      options={{
        placement: 'top',
        offset: 8
      }}
      editor={editor}>
      <div className="bubble-menu-container">
        {/* Clipboard - icon only (universal symbols) */}
        <div className="bubble-menu-group">
          <button
            className="bubble-menu-btn--icon"
            onTouchEnd={preventScrollAndRun(cut)}
            onClick={preventScrollAndRun(cut)}>
            <MdContentCut size={18} />
          </button>
          <button
            className={`bubble-menu-btn--icon ${copied ? 'copied' : ''}`}
            onTouchEnd={preventScrollAndRun(copy)}
            onClick={preventScrollAndRun(copy)}>
            <MdContentCopy size={18} />
          </button>
          <button
            className="bubble-menu-btn--icon"
            onTouchEnd={preventScrollAndRun(paste)}
            onClick={preventScrollAndRun(paste)}>
            <MdContentPaste size={18} />
          </button>
        </div>

        <div className="bubble-menu-divider" />

        {/* Primary Actions - icon + label inline */}
        <div className="bubble-menu-group">
          <button
            className="bubble-menu-btn"
            onTouchEnd={preventScrollAndRun(handleComment)}
            onClick={preventScrollAndRun(handleComment)}>
            <MdOutlineComment size={18} />
            <span>Comment</span>
          </button>
          <button
            className="bubble-menu-btn"
            onTouchEnd={preventScrollAndRun(handleLink)}
            onClick={preventScrollAndRun(handleLink)}>
            <MdInsertLink size={18} />
            <span>Link</span>
          </button>
        </div>
      </div>
    </BubbleMenu>
  )
}
