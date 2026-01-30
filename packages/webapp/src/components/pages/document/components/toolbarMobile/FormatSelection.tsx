import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { HighlightMarker } from '@icons'
import { Editor } from '@tiptap/core'
import { useEffect, useRef } from 'react'
import {
  MdChecklist,
  MdFormatBold,
  MdFormatClear,
  MdFormatItalic,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatUnderlined} from 'react-icons/md'
import { MdOutlineStrikethroughS } from 'react-icons/md'

const FormatSelection = ({ isVisible, editor }: { isVisible: boolean; editor: Editor }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Handle visibility and transitions
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (isVisible) {
      // Show: make visible immediately for smooth transition
      container.style.visibility = 'visible'
    } else {
      // Hide: wait for transition to complete (300ms), then hide from DOM
      timeoutRef.current = setTimeout(() => {
        if (container && !isVisible) {
          container.style.visibility = 'hidden'
        }
      }, 300)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isVisible])

  return (
    <div
      ref={containerRef}
      className={`tiptap-toolbar-mobile__format-selection bg-base-100 absolute top-0 left-0 z-0 w-full space-y-6 rounded-t-3xl px-4 py-6 transition-all duration-300 ${
        isVisible
          ? 'pointer-events-auto -translate-y-[134px] opacity-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1),_0_-2px_4px_-1px_rgba(0,0,0,0.06)]'
          : 'pointer-events-none translate-y-0 opacity-0'
      }`}>
      <div className="flex items-center justify-between">
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleBold().run()}
          editor={editor}
          type="bold">
          <MdFormatBold size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleItalic().run()}
          editor={editor}
          type="italic">
          <MdFormatItalic size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleUnderline().run()}
          editor={editor}
          type="underline">
          <MdFormatUnderlined size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleStrike().run()}
          editor={editor}
          type="strike">
          <MdOutlineStrikethroughS size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleHighlight().run()}
          editor={editor}
          type="highlight">
          <HighlightMarker size={20} />
        </ToolbarButton>
      </div>
      <div className="flex items-center justify-between">
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleTaskList().run()}
          editor={editor}
          type="taskList">
          <MdChecklist size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleBulletList().run()}
          editor={editor}
          type="bulletList">
          <MdFormatListBulleted size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleOrderedList().run()}
          editor={editor}
          type="orderedList">
          <MdFormatListNumbered size={24} />
        </ToolbarButton>
        <div className="divided"></div>

        <ToolbarButton
          onTouchEnd={() => {
            const range = editor.view.state.selection.ranges[0]
            if (range.$from === range.$to) {
              editor.commands.clearNodes()
            } else {
              editor.commands.unsetAllMarks()
            }
          }}
          editor={editor}
          type="clearFormatting">
          <MdFormatClear size={24} />
        </ToolbarButton>
      </div>
    </div>
  )
}

export default FormatSelection
