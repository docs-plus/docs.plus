import { Icons } from '@icons'
import { Editor } from '@tiptap/core'
import { RefObject } from 'react'

import { clearFormatting } from '../clearFormatting'
import ToolbarButton from '../ToolbarButton'
import ToolbarDivider from '../ToolbarDivider'

/** Every format control is 44px to meet the mobile touch target. */
const FORMAT_BTN = 'min-h-11 min-w-11 touch-manipulation'

const FormatSelection = ({
  isVisible,
  editor,
  id,
  rootRef
}: {
  isVisible: boolean
  editor: Editor
  /** Required: the format toggle points `aria-controls` at this id. */
  id: string
  /** Parent reads this node's height on demand for the caret-scroll math. */
  rootRef: RefObject<HTMLDivElement | null>
}) => {
  return (
    <div
      ref={rootRef}
      id={id}
      inert={!isVisible ? true : undefined}
      className={`tiptap-toolbar-mobile__format-selection bg-base-100 rounded-t-box absolute top-0 left-0 z-0 w-full -translate-y-full space-y-6 px-4 py-6 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out ${
        isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}>
      <div className="flex items-center justify-between">
        <ToolbarButton
          onPress={() => editor.chain().focus().toggleBold().run()}
          editor={editor}
          type="bold"
          aria-label="Bold"
          aria-pressed={editor.isActive('bold')}
          className={FORMAT_BTN}>
          <Icons.bold size={24} />
        </ToolbarButton>
        <ToolbarButton
          onPress={() => editor.chain().focus().toggleItalic().run()}
          editor={editor}
          type="italic"
          aria-label="Italic"
          aria-pressed={editor.isActive('italic')}
          className={FORMAT_BTN}>
          <Icons.italic size={24} />
        </ToolbarButton>
        <ToolbarButton
          onPress={() => editor.chain().focus().toggleUnderline().run()}
          editor={editor}
          type="underline"
          aria-label="Underline"
          aria-pressed={editor.isActive('underline')}
          className={FORMAT_BTN}>
          <Icons.underline size={24} />
        </ToolbarButton>
        <ToolbarButton
          onPress={() => editor.chain().focus().toggleStrike().run()}
          editor={editor}
          type="strike"
          aria-label="Strikethrough"
          aria-pressed={editor.isActive('strike')}
          className={FORMAT_BTN}>
          <Icons.strikethrough size={24} />
        </ToolbarButton>
        <ToolbarButton
          onPress={() => editor.chain().focus().toggleHighlight().run()}
          editor={editor}
          type="highlight"
          aria-label="Highlight"
          aria-pressed={editor.isActive('highlight')}
          className={FORMAT_BTN}>
          <Icons.highlight size={22} />
        </ToolbarButton>
      </div>
      <div className="flex items-center justify-between">
        <ToolbarButton
          onPress={() => editor.chain().focus().toggleTaskList().run()}
          editor={editor}
          type="taskList"
          aria-label="Task list"
          aria-pressed={editor.isActive('taskList')}
          className={FORMAT_BTN}>
          <Icons.taskList size={24} />
        </ToolbarButton>
        <ToolbarButton
          onPress={() => editor.chain().focus().toggleBulletList().run()}
          editor={editor}
          type="bulletList"
          aria-label="Bulleted list"
          aria-pressed={editor.isActive('bulletList')}
          className={FORMAT_BTN}>
          <Icons.bulletList size={24} />
        </ToolbarButton>
        <ToolbarButton
          onPress={() => editor.chain().focus().toggleOrderedList().run()}
          editor={editor}
          type="orderedList"
          aria-label="Numbered list"
          aria-pressed={editor.isActive('orderedList')}
          className={FORMAT_BTN}>
          <Icons.orderedList size={24} />
        </ToolbarButton>
        <ToolbarDivider className="h-6" />
        <ToolbarButton
          onPress={() => clearFormatting(editor)}
          aria-label="Clear formatting"
          className={FORMAT_BTN}>
          <Icons.clearFormatting size={24} />
        </ToolbarButton>
      </div>
    </div>
  )
}

export default FormatSelection
