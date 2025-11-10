import { Editor } from '@tiptap/core'
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  MdFormatClear,
  MdChecklist,
  MdFormatListBulleted,
  MdFormatListNumbered
} from 'react-icons/md'
import { MdOutlineStrikethroughS } from 'react-icons/md'
import { HighlightMarker } from '@icons'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'

const FormatSelection = ({ isVisible, editor }: { isVisible: boolean; editor: Editor }) => {
  return (
    <div
      className={`tiptap-toolbar-mobile__format-selection absolute left-0 top-0 z-0 w-full space-y-6 rounded-t-3xl bg-base-100 px-4 py-6 transition-all ${
        isVisible
          ? '-translate-y-[134px] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1),_0_-2px_4px_-1px_rgba(0,0,0,0.06)]'
          : 'translate-y-[0]'
      } `}>
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
