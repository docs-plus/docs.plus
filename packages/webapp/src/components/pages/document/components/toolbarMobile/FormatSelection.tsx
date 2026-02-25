import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { Icons } from '@icons'
import { Editor } from '@tiptap/core'
import { useEffect, useRef } from 'react'

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
        <div className="divided"></div>

        <ToolbarButton
          onTouchEnd={() => {
            try {
              const selection = editor.state.selection

              if (!selection.empty) {
                editor.chain().focus().unsetAllMarks().run()
                return
              }

              const cleared = editor.chain().focus().clearNodes().run()
              if (!cleared) {
                editor.chain().focus().unsetAllMarks().run()
              }
            } catch (error) {
              console.warn('[FormatSelection] clear formatting fallback', error)
              editor.chain().focus().unsetAllMarks().run()
            }
          }}
          editor={editor}
          type="clearFormatting">
          <Icons.clearFormatting size={24} />
        </ToolbarButton>
      </div>
    </div>
  )
}

export default FormatSelection
