import dynamic from 'next/dynamic'
import React from 'react'
import { Link, Gear, ClearMark, Filter, Folder } from '@icons'
import ToolbarButton from './ToolbarButton'
import Icon from './Icon'
import FilterModal from './FilterModal'
import { useEditorStateContext } from '@context/EditorContext'
import { Popover, PopoverTrigger } from '@components/ui/Popover'
import { Dialog, DialogTrigger, DialogContent } from '@components/ui/Dialog'
import SelectHeadingBox from './SelectHeadingBox'
import InsertMultimediaButton from './InsertMultimediaButton'
const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <div>Loading...</div>
})
const GearModal = dynamic(() => import('./GearModal'))

const Toolbar = ({ editor, docMetadata }) => {
  const { isAuthServiceAvailable } = useEditorStateContext()

  return (
    <div className="tiptap__toolbar   editorButtons justify-between sm:justify-start flex flex-row items-center px-1 sm:px-4">
      {/* <ToolbarButton onClick={() => editor.chain().focus().undo().run()} editor={editor} type="undo">
        <Icon type="Undo" size="16" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} editor={editor} type="redo">
        <Icon type="Redo" size="16" />
      </ToolbarButton> */}

      <SelectHeadingBox editor={editor} />

      <div className="divided"></div>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        editor={editor}
        tooltip="Bold (⌘+B)"
        type="bold">
        <Icon type="Bold" size="10" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        editor={editor}
        tooltip="Italic (⌘+I)"
        type="italic">
        <Icon type="Italic" size="10" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        editor={editor}
        tooltip="Underline (⌘+U)"
        type="underline">
        <Icon type="Underline" size="10" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        editor={editor}
        tooltip="Strike (⌘+S)"
        type="strike">
        <Icon type="Stric" size="14" />
      </ToolbarButton>

      <div className="divided"></div>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        editor={editor}
        tooltip="Ordered List (⌘+⇧+7)"
        type="orderedList">
        <Icon type="OrderList" size="16" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        editor={editor}
        tooltip="Bullet List (⌘+⇧+8)"
        type="bulletList">
        <Icon type="BulletList" size="16" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        editor={editor}
        tooltip="Task List (⌘+⇧+9)"
        type="taskList">
        <Icon type="CheckList" size="16" />
      </ToolbarButton>

      <div className="divided"></div>

      <InsertMultimediaButton editor={editor} docMetadata={docMetadata} />

      <ToolbarButton
        onClick={() => editor.chain().focus().setHyperlink().run()}
        editor={editor}
        tooltip="Hyperlink (⌘+K)"
        type="hyperlink">
        <Link fill="rgba(0,0,0,.7)" size="18" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        editor={editor}
        tooltip="Highlight (⌘+H)"
        type="highlight">
        <Icon type="HighlightMarker" size="14" />
      </ToolbarButton>

      <div className="divided"></div>

      <ToolbarButton
        tooltip="Clear Formatting"
        onClick={() => {
          const range = editor.view.state.selection.ranges[0]
          if (range.$from === range.$to) {
            editor.commands.clearNodes()
          } else {
            editor.commands.unsetAllMarks()
          }
        }}>
        <ClearMark fill="rgba(0,0,0,.7)" size="14" />
      </ToolbarButton>

      <div className="ml-auto flex align-baseline items-center">
        <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)">
          <Icon type="Printer" size="16" />
        </ToolbarButton>

        {isAuthServiceAvailable && (
          <Dialog>
            <DialogTrigger asChild={true}>
              <ToolbarButton tooltip="Open">
                <Folder fill="rgba(0,0,0,.7)" size="18" />
              </ToolbarButton>
            </DialogTrigger>
            <DialogContent>
              <ControlCenter />
            </DialogContent>
          </Dialog>
        )}

        <div className="divided"></div>

        <Popover>
          <PopoverTrigger asChild={true}>
            <ToolbarButton tooltip="Filter Document">
              <Filter fill="rgba(0,0,0,.7)" size="20" />
            </ToolbarButton>
          </PopoverTrigger>
          <FilterModal className="z-50" />
        </Popover>

        <Popover>
          <PopoverTrigger asChild={true}>
            <ToolbarButton tooltip="Document Settings">
              <Gear fill="rgba(0,0,0,.7)" size="16" />
            </ToolbarButton>
          </PopoverTrigger>
          <GearModal docMetadata={docMetadata} className="z-50" />
        </Popover>
      </div>
    </div>
  )
}

export default React.memo(Toolbar)
