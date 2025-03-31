import dynamic from 'next/dynamic'
import React, { useCallback, useState } from 'react'
import { Link, Gear, ClearMark, Filter, Folder } from '@icons'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import Icon from '@components/TipTap/toolbar/Icon'
import FilterModal from './FilterModal'
import SelectHeadingBox from './SelectHeadingBox'
import InsertMultimediaButton from './InsertMultimediaButton'
import { useStore } from '@stores'
import Dropdown from '@components/ui/Dropdown'
import Loading from '@components/ui/Loading'
import Modal from '@components/ui/Modal'
import ToolbarSkeleton from '@components/skeleton/ToolbarLoader'
import { MdAddComment } from 'react-icons/md'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'
import { FaDiscord } from 'react-icons/fa'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <Loading />
})
const GearModal = dynamic(() => import('./GearModal'), {
  loading: () => <Loading />
})

const FilterButton = () => {
  return (
    <ToolbarButton tooltip="Filter Document" position="tooltip-left">
      <Filter fill="rgba(0,0,0,.7)" size={20} />
    </ToolbarButton>
  )
}

const GearButton = () => {
  return (
    <ToolbarButton tooltip="Document Settings" position="tooltip-left">
      <Gear fill="rgba(0,0,0,.7)" size={16} />
    </ToolbarButton>
  )
}

const ToolbarDesktop = () => {
  const {
    editor: { instance: editor, loading, providerSyncing }
  } = useStore((state) => state.settings)
  const { isAuthServiceAvailable } = useStore((state) => state.settings)
  const [isModalOpen, setModalOpen] = useState(false)

  const { createComment } = useTurnSelectedTextIntoComment()

  // TODO: skeleton loading
  if (loading || providerSyncing || !editor) return <ToolbarSkeleton />

  return (
    <>
      <div className="tiptap__toolbar editorButtons flex flex-row items-center justify-between space-x-1 px-1 sm:justify-start sm:px-4">
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
          <Icon type="Bold" size={10} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          editor={editor}
          tooltip="Italic (⌘+I)"
          type="italic">
          <Icon type="Italic" size={10} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          editor={editor}
          tooltip="Underline (⌘+U)"
          type="underline">
          <Icon type="Underline" size={10} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          editor={editor}
          tooltip="Strike (⌘+⇧+S)"
          type="strike">
          <Icon type="Stric" size={14} />
        </ToolbarButton>

        <div className="divided"></div>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          editor={editor}
          tooltip="Ordered List (⌘+⇧+7)"
          type="orderedList">
          <Icon type="OrderList" size={16} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          editor={editor}
          tooltip="Bullet List (⌘+⇧+8)"
          type="bulletList">
          <Icon type="BulletList" size={16} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          editor={editor}
          tooltip="Task List (⌘+⇧+9)"
          type="taskList">
          <Icon type="CheckList" size={16} />
        </ToolbarButton>

        <div className="divided"></div>

        <InsertMultimediaButton />

        <ToolbarButton
          onClick={() => createComment(editor)}
          editor={editor}
          tooltip="comment (⌘+Option+M)"
          type="chatComment">
          <MdAddComment fill="rgba(0,0,0,.7)" size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setHyperlink().run()}
          editor={editor}
          tooltip="Hyperlink (⌘+K)"
          type="hyperlink">
          <Link fill="rgba(0,0,0,.7)" size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          editor={editor}
          tooltip="Highlight (⌘+H)"
          type="highlight">
          <Icon type="HighlightMarker" size={14} />
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
          <ClearMark fill="rgba(0,0,0,.7)" size={14} />
        </ToolbarButton>

        <div className="!ml-auto flex items-center align-baseline">
          <ToolbarButton
            onClick={() => window.open('https://discord.gg/25JPG38J59', '_blank')}
            tooltip="Join Discord Community">
            <FaDiscord size={18} className="text-[#5865F2]" />
          </ToolbarButton>

          <div className="divided"></div>

          <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)">
            <Icon type="Printer" size={16} />
          </ToolbarButton>
          {isAuthServiceAvailable && (
            <ToolbarButton tooltip="Open" onClick={() => setModalOpen(true)}>
              <Folder fill="rgba(0,0,0,.7)" size={18} />
            </ToolbarButton>
          )}
          <div className="divided"></div>

          <Dropdown button={<GearButton />}>
            <GearModal className="z-50" />
          </Dropdown>

          <Dropdown button={<FilterButton />}>
            <FilterModal className="z-50" />
          </Dropdown>
        </div>
      </div>
      <Modal asAChild={false} id="modal_profile" isOpen={isModalOpen} setIsOpen={setModalOpen}>
        <ControlCenter defaultTab="documents" />
      </Modal>
    </>
  )
}

export default React.memo(ToolbarDesktop)
