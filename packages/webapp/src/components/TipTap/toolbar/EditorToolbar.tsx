import { BookmarkPanelSkeleton } from '@components/bookmarkPanel/components/BookmarkPanelSkeleton'
import SettingsPanelSkeleton from '@components/settings/SettingsPanelSkeleton'
import ToolbarSkeleton from '@components/skeleton/ToolbarLoader'
import Button from '@components/ui/Button'
import { Modal, ModalContent } from '@components/ui/Dialog'
import Loading from '@components/ui/Loading'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/Popover'
import { Icons } from '@icons'
import useCopyDocumentToClipboard from '@pages/document/hooks/useCopyDocumentToClipboard'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'
import { useAuthStore, useStore } from '@stores'
import dynamic from 'next/dynamic'
import React, { useState } from 'react'

import { FilterPanelSkeleton } from './FilterPanelSkeleton'
import { GearPanelSkeleton } from './GearPanelSkeleton'
import StyleSelect from './StyleSelect'

/* ── Lazy-loaded panels ── */

const MediaInsertPanel = dynamic(() => import('./InsertMultimediaForm'), {
  loading: () => <Loading />
})

const SettingsPanel = dynamic(() => import('@components/settings/SettingsPanel'), {
  loading: () => <SettingsPanelSkeleton />
})

const DocumentSettingsPanel = dynamic(() => import('./GearModal'), {
  loading: () => <GearPanelSkeleton />
})

const BookmarkPanel = dynamic(() => import('./BookmarkModal'), {
  loading: () => <BookmarkPanelSkeleton />
})

const FilterPanel = dynamic(() => import('./FilterModal'), {
  loading: () => <FilterPanelSkeleton />
})

/* ── Constants ── */

const ICON_SIZE = 16
const PANEL_CLASS =
  'rounded-box border-base-300 bg-base-100 z-50 w-[28rem] overflow-hidden border p-0 shadow-xl'

/** Visual separator between toolbar groups */
const Divider = () => <div className="bg-base-300 mx-2 h-5 w-px" />

/* ── Component ── */

const EditorToolbar = () => {
  const {
    editor: { instance: editor, loading, providerSyncing },
    isAuthServiceAvailable
  } = useStore((state) => state.settings)
  const user = useAuthStore((state) => state.profile)
  const [isDocumentsOpen, setDocumentsOpen] = useState(false)

  const { createComment } = useTurnSelectedTextIntoComment()
  const { copyDocumentToClipboard, copied } = useCopyDocumentToClipboard(editor ?? null)

  if (loading || providerSyncing || !editor) return <ToolbarSkeleton />

  /** Returns `is-active` class when the given editor mark/node is active */
  const active = (type: string) => (editor.isActive(type) ? 'is-active' : '')

  return (
    <>
      <div className="tiptap__toolbar bg-base-100 border-base-300 flex flex-row items-center justify-between gap-0.5 border-b px-3 py-1.5 sm:justify-start">
        <StyleSelect editor={editor} />

        <Divider />

        {/* Text formatting */}

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          tooltip="Bold (⌘+B)">
          <Icons.bold size={ICON_SIZE} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          tooltip="Italic (⌘+I)">
          <Icons.italic size={ICON_SIZE} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          tooltip="Underline (⌘+U)">
          <Icons.underline size={ICON_SIZE} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          tooltip="Strikethrough (⌘+⇧+S)">
          <Icons.strikethrough size={ICON_SIZE} />
        </Button>

        <Divider />

        {/* Lists */}

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          tooltip="Ordered List (⌘+⇧+7)">
          <Icons.orderedList size={ICON_SIZE} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          tooltip="Bullet List (⌘+⇧+8)">
          <Icons.bulletList size={ICON_SIZE} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          tooltip="Task List (⌘+⇧+9)">
          <Icons.taskList size={ICON_SIZE} />
        </Button>

        <Divider />

        {/* Rich content */}

        <Popover placement="bottom-start">
          <PopoverTrigger asChild>
            <div>
              <Button variant="ghost" size="sm" shape="square" tooltip="Insert Media">
                <Icons.image size={ICON_SIZE} />
              </Button>
            </div>
          </PopoverTrigger>
          <PopoverContent className="rounded-box border-base-300 bg-base-100 border p-4 shadow-lg">
            <MediaInsertPanel />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('chatComment')}
          onClick={() => createComment(editor)}
          tooltip="Comment (⌘+⌥+M)">
          <Icons.comment size={ICON_SIZE} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('hyperlink')}
          onClick={() => {
            // @ts-ignore – setHyperlink is valid but not in Docker build TS types
            editor.chain().focus().setHyperlink().run()
          }}
          tooltip="Hyperlink (⌘+K)">
          <Icons.link size={ICON_SIZE} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          className={active('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          tooltip="Highlight (⌘+H)">
          <Icons.highlight size={ICON_SIZE} />
        </Button>

        <Divider />

        <Button
          variant="ghost"
          size="sm"
          shape="square"
          onClick={() => {
            const range = editor.view.state.selection.ranges[0]
            if (range.$from === range.$to) {
              editor.commands.clearNodes()
            } else {
              editor.commands.unsetAllMarks()
            }
          }}
          tooltip="Clear Formatting">
          <Icons.clearFormatting size={ICON_SIZE} />
        </Button>

        {/* Right-side actions */}

        <div className="!ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            onClick={() => window.open('https://discord.gg/25JPG38J59', '_blank')}
            tooltip="Join Discord Community">
            <Icons.discord size={ICON_SIZE} className="text-[#5865F2]" />
          </Button>

          <Divider />

          <Button
            variant="ghost"
            size="sm"
            shape="square"
            onClick={copyDocumentToClipboard}
            tooltip={copied ? 'Copied!' : 'Copy Document'}>
            {copied ? (
              <Icons.check size={ICON_SIZE} className="text-success" />
            ) : (
              <Icons.copy size={ICON_SIZE} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            shape="square"
            onClick={() => window.print()}
            tooltip="Print (⌘+P)">
            <Icons.print size={ICON_SIZE} />
          </Button>

          {isAuthServiceAvailable && user && (
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              onClick={() => setDocumentsOpen(true)}
              tooltip="Documents">
              <Icons.documents size={ICON_SIZE} />
            </Button>
          )}

          {user && <Divider />}

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <Button variant="ghost" size="sm" shape="square" tooltip="Bookmarks">
                  <Icons.bookmark size={ICON_SIZE} />
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent className={PANEL_CLASS}>
              <BookmarkPanel />
            </PopoverContent>
          </Popover>

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <Button variant="ghost" size="sm" shape="square" tooltip="Filter Document">
                  <Icons.filter size={ICON_SIZE} />
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent className={PANEL_CLASS}>
              <FilterPanel />
            </PopoverContent>
          </Popover>

          <Divider />

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  tooltip="Document Settings"
                  tooltipPlacement="left">
                  <Icons.settings size={ICON_SIZE} />
                </Button>
              </div>
            </PopoverTrigger>
            <PopoverContent className={PANEL_CLASS}>
              <DocumentSettingsPanel />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Modal open={isDocumentsOpen} onOpenChange={setDocumentsOpen}>
        <ModalContent size="4xl" className="rounded-box overflow-hidden p-0">
          <SettingsPanel defaultTab="documents" onClose={() => setDocumentsOpen(false)} />
        </ModalContent>
      </Modal>
    </>
  )
}

export default React.memo(EditorToolbar)
