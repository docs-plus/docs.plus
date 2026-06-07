import { Icons } from '@icons'
import { Editor } from '@tiptap/core'
import { useEffect, useRef } from 'react'

import { clearFormatting } from '../clearFormatting'
import ToolbarButton from '../ToolbarButton'
import ToolbarDivider from '../ToolbarDivider'

const FormatSelection = ({ isVisible, editor }: { isVisible: boolean; editor: Editor }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (isVisible) {
      container.style.visibility = 'visible'
    } else {
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
          ? 'pointer-events-auto -translate-y-[134px] opacity-100 shadow-lg'
          : 'pointer-events-none translate-y-0 opacity-0'
      }`}>
      <div className="flex items-center justify-between">
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleBold().run()}
          editor={editor}
          type="bold">
          <Icons.bold size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleItalic().run()}
          editor={editor}
          type="italic">
          <Icons.italic size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleUnderline().run()}
          editor={editor}
          type="underline">
          <Icons.underline size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleStrike().run()}
          editor={editor}
          type="strike">
          <Icons.strikethrough size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleHighlight().run()}
          editor={editor}
          type="highlight">
          <Icons.highlight size={20} />
        </ToolbarButton>
      </div>
      <div className="flex items-center justify-between">
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleTaskList().run()}
          editor={editor}
          type="taskList">
          <Icons.taskList size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleBulletList().run()}
          editor={editor}
          type="bulletList">
          <Icons.bulletList size={24} />
        </ToolbarButton>
        <ToolbarButton
          onTouchEnd={() => editor.chain().focus().toggleOrderedList().run()}
          editor={editor}
          type="orderedList">
          <Icons.orderedList size={24} />
        </ToolbarButton>
        <ToolbarDivider className="h-6" />
        <ToolbarButton onTouchEnd={() => clearFormatting(editor)}>
          <Icons.clearFormatting size={24} />
        </ToolbarButton>
      </div>
    </div>
  )
}

export default FormatSelection
