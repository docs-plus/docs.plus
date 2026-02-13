import { BookmarkPanelSkeleton } from '@components/bookmarkPanel/components/BookmarkPanelSkeleton'
import SettingsPanelSkeleton from '@components/settings/SettingsPanelSkeleton'
import ToolbarSkeleton from '@components/skeleton/ToolbarLoader'
import Icon from '@components/TipTap/toolbar/Icon'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { Modal, ModalContent } from '@components/ui/Dialog'
import Loading from '@components/ui/Loading'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/Popover'
import { ClearMark, ImageBox, Link } from '@icons'
import useCopyDocumentToClipboard from '@pages/document/hooks/useCopyDocumentToClipboard'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'
import { useAuthStore, useStore } from '@stores'
import dynamic from 'next/dynamic'
import React, { useState } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { LuBookmark, LuFilter, LuSettings } from 'react-icons/lu'
import {
  MdAddComment,
  MdCheck,
  MdOutlineFileCopy,
  MdOutlineFolder,
  MdOutlinePrint
} from 'react-icons/md'

import { FilterPanelSkeleton } from './FilterPanelSkeleton'
import { GearPanelSkeleton } from './GearPanelSkeleton'
import SelectHeadingBox from './SelectHeadingBox'

const InsertMultimediaForm = dynamic(() => import('./InsertMultimediaForm'), {
  loading: () => <Loading />
})

const SettingsPanel = dynamic(() => import('@components/settings/SettingsPanel'), {
  loading: () => <SettingsPanelSkeleton />
})

const GearModal = dynamic(() => import('./GearModal'), {
  loading: () => <GearPanelSkeleton />
})

const BookmarkModal = dynamic(() => import('./BookmarkModal'), {
  loading: () => <BookmarkPanelSkeleton />
})

const FilterModal = dynamic(() => import('./FilterModal'), {
  loading: () => <FilterPanelSkeleton />
})

const BookmarkButton = () => {
  return (
    <ToolbarButton tooltip="Bookmarks" position="tooltip-bottom">
      <LuBookmark className="text-base-content" size={18} />
    </ToolbarButton>
  )
}

const FilterButton = () => {
  return (
    <ToolbarButton tooltip="Filter Document" position="tooltip-bottom">
      <LuFilter className="text-base-content" size={16} />
    </ToolbarButton>
  )
}

const InsertMediaButton = () => {
  return (
    <ToolbarButton tooltip="Insert Media" position="tooltip-bottom">
      <ImageBox className="text-base-content" size={14} />
    </ToolbarButton>
  )
}

const GearButton = () => {
  return (
    <ToolbarButton tooltip="Document Settings" position="tooltip-left">
      <LuSettings className="text-base-content" size={18} />
    </ToolbarButton>
  )
}

const ToolbarDesktop = () => {
  const {
    editor: { instance: editor, loading, providerSyncing }
  } = useStore((state) => state.settings)
  const { isAuthServiceAvailable } = useStore((state) => state.settings)
  const [isModalOpen, setModalOpen] = useState(false)
  const user = useAuthStore((state) => state.profile)

  const { createComment } = useTurnSelectedTextIntoComment()
  const { copyDocumentToClipboard, copied } = useCopyDocumentToClipboard(editor ?? null)

  // TODO: skeleton loading
  if (loading || providerSyncing || !editor) return <ToolbarSkeleton />

  return (
    <>
      <div className="bg-base-100 border-base-300 flex flex-row items-center justify-between gap-0.5 border-b px-3 py-1.5 sm:justify-start">
        {/* <ToolbarButton onClick={() => editor.chain().focus().undo().run()} editor={editor} type="undo">
        <Icon type="Undo" size="16" />
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} editor={editor} type="redo">
        <Icon type="Redo" size="16" />
      </ToolbarButton> */}

        <SelectHeadingBox editor={editor} />

        <div className="bg-base-300 mx-2 h-5 w-px" />

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

        <div className="bg-base-300 mx-2 h-5 w-px" />

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

        <div className="bg-base-300 mx-2 h-5 w-px" />

        <Popover placement="bottom-start">
          <PopoverTrigger asChild>
            <div>
              <InsertMediaButton />
            </div>
          </PopoverTrigger>
          <PopoverContent className="rounded-box border-base-300 bg-base-100 border p-4 shadow-lg">
            <InsertMultimediaForm />
          </PopoverContent>
        </Popover>

        <ToolbarButton
          onClick={() => createComment(editor)}
          editor={editor}
          tooltip="comment (⌘+Option+M)"
          type="chatComment">
          <MdAddComment className="text-base-content" size={18} />
        </ToolbarButton>

        <ToolbarButton
          // @ts-ignore - setHyperlink is a valid command but TypeScript types aren't picking it up in Docker builds
          onClick={() => editor.chain().focus().setHyperlink().run()}
          editor={editor}
          tooltip="Hyperlink (⌘+K)"
          type="hyperlink">
          <Link className="text-base-content" size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          editor={editor}
          tooltip="Highlight (⌘+H)"
          type="highlight">
          <Icon type="HighlightMarker" size={14} />
        </ToolbarButton>

        <div className="bg-base-300 mx-2 h-5 w-px" />

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
          <ClearMark className="text-base-content" size={14} />
        </ToolbarButton>

        <div className="!ml-auto flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => window.open('https://discord.gg/25JPG38J59', '_blank')}
            tooltip="Join Discord Community">
            <FaDiscord size={18} className="text-[#5865F2]" />
          </ToolbarButton>

          <div className="bg-base-300 mx-2 h-5 w-px" />
          <ToolbarButton
            tooltip={copied ? 'Copied!' : 'Copy Document'}
            onClick={copyDocumentToClipboard}>
            {copied ? (
              <MdCheck size={18} className="text-success" />
            ) : (
              <MdOutlineFileCopy className="text-base-content" size={18} />
            )}
          </ToolbarButton>

          <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)">
            <MdOutlinePrint className="text-base-content" size={20} />
          </ToolbarButton>

          {isAuthServiceAvailable && user && (
            <ToolbarButton tooltip="Open" onClick={() => setModalOpen(true)}>
              <MdOutlineFolder className="text-base-content" size={16} />
            </ToolbarButton>
          )}

          {user && <div className="bg-base-300 mx-2 h-5 w-px" />}

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <BookmarkButton />
              </div>
            </PopoverTrigger>
            <PopoverContent className="rounded-box border-base-300 bg-base-100 z-50 w-[28rem] overflow-hidden border p-0 shadow-xl">
              <BookmarkModal />
            </PopoverContent>
          </Popover>

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <FilterButton />
              </div>
            </PopoverTrigger>
            <PopoverContent className="rounded-box border-base-300 bg-base-100 z-50 w-[28rem] overflow-hidden border p-0 shadow-xl">
              <FilterModal />
            </PopoverContent>
          </Popover>
          <div className="bg-base-300 mx-2 h-5 w-px" />

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <GearButton />
              </div>
            </PopoverTrigger>
            <PopoverContent className="rounded-box border-base-300 bg-base-100 z-50 w-[28rem] overflow-hidden border p-0 shadow-xl">
              <GearModal />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <Modal open={isModalOpen} onOpenChange={setModalOpen}>
        <ModalContent size="4xl" className="rounded-box overflow-hidden p-0">
          <SettingsPanel defaultTab="documents" onClose={() => setModalOpen(false)} />
        </ModalContent>
      </Modal>
    </>
  )
}

export default React.memo(ToolbarDesktop)
