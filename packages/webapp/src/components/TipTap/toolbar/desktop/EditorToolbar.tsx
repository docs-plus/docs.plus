import { BookmarkPanelSkeleton } from '@components/bookmarkPanel/components/BookmarkPanelSkeleton'
import SettingsPanelSkeleton from '@components/settings/SettingsPanelSkeleton'
import ToolbarSkeleton from '@components/skeleton/ToolbarSkeleton'
import { Modal, ModalContent } from '@components/ui/Dialog'
import Loading from '@components/ui/Loading'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/Popover'
import useReRenderOnEditorTransaction from '@hooks/useReRenderOnEditorTransaction'
import { Icons } from '@icons'
import useCopyDocumentToClipboard from '@pages/document/hooks/useCopyDocumentToClipboard'
import useTurnSelectedTextIntoComment from '@pages/document/hooks/useTurnSelectedTextIntoComment'
import { useAuthStore, useStore } from '@stores'
import dynamic from 'next/dynamic'
import React, { useEffect, useRef, useState } from 'react'

import { clearFormatting } from '../clearFormatting'
import ToolbarButton from '../ToolbarButton'
import ToolbarDivider from '../ToolbarDivider'
import ToolbarSelect from '../ToolbarSelect'
import { DocumentSettingsSkeleton } from './DocumentSettingsSkeleton'
import { FilterSkeleton } from './FilterSkeleton'
import StyleSelect from './StyleSelect'

/* ── Lazy-loaded panels ── */

const MediaInsertPanel = dynamic(() => import('./MediaInsertPanel'), {
  loading: () => <Loading />
})

const SettingsPanel = dynamic(() => import('@components/settings/SettingsPanel'), {
  loading: () => <SettingsPanelSkeleton />
})

const DocumentSettingsPanel = dynamic(() => import('./DocumentSettingsPanel'), {
  loading: () => <DocumentSettingsSkeleton />
})

const BookmarkPanel = dynamic(() => import('./BookmarkPanel'), {
  loading: () => <BookmarkPanelSkeleton />
})

const FilterPanel = dynamic(() => import('./FilterPanel'), {
  loading: () => <FilterSkeleton />
})

/* ── Constants ── */

const ICON_SIZE = 16
const PANEL_CLASS =
  'rounded-box border-base-300 bg-base-100 z-50 w-[28rem] overflow-hidden border p-0 shadow-xl'

/* ── Component ── */

const EditorToolbar = () => {
  const editor = useStore((state) => state.settings.editor.instance)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const user = useAuthStore((state) => state.profile)
  const [isDocumentsOpen, setDocumentsOpen] = useState(false)

  useReRenderOnEditorTransaction(editor ?? null)

  const { createComment } = useTurnSelectedTextIntoComment()
  const { copyDocumentToClipboard, copied } = useCopyDocumentToClipboard(editor ?? null)
  const clearFormattingSelectionRef = useRef<{
    from: number
    to: number
    empty: boolean
  } | null>(null)

  useEffect(() => {
    if (!editor) return

    const onKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey
      if (!isMod || !event.altKey) return
      if (event.key.toLowerCase() !== 'm') return

      event.preventDefault()
      createComment(editor)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor, createComment])

  if (loading || providerSyncing || !editor) return <ToolbarSkeleton />

  return (
    <>
      {/* Pad chrome borders: PadTitle `border-b` (header↔toolbar); this row `border-b` only (toolbar↔workspace); sheet top edge is `.tiptap__editor` in _blocks.scss — do not add `border-t` here or you double the header seam. */}
      <div className="tiptap__toolbar border-base-300 bg-base-100 flex min-w-0 flex-row items-center justify-between gap-0.5 border-b px-3 py-1.5 sm:justify-start">
        <StyleSelect editor={editor} />

        <ToolbarDivider />

        {/* Text formatting */}

        <ToolbarButton
          editor={editor}
          type="bold"
          data-testid="toolbar-bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          tooltip="Bold (⌘+B)">
          <Icons.bold size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="italic"
          data-testid="toolbar-italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          tooltip="Italic (⌘+I)">
          <Icons.italic size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="underline"
          data-testid="toolbar-underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          tooltip="Underline (⌘+U)">
          <Icons.underline size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="strike"
          data-testid="toolbar-strike"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          tooltip="Strikethrough (⌘+⇧+S)">
          <Icons.strikethrough size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="highlight"
          data-testid="toolbar-highlight"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          tooltip="Highlight (⌘+⇧+H)">
          <Icons.highlight size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Rich content */}

        <Popover placement="bottom-start">
          <PopoverTrigger asChild>
            <div>
              <ToolbarButton tooltip="Insert Media">
                <Icons.image size={ICON_SIZE} />
              </ToolbarButton>
            </div>
          </PopoverTrigger>
          <PopoverContent className="rounded-box border-base-300 bg-base-100 border p-4 shadow-lg">
            <MediaInsertPanel />
          </PopoverContent>
        </Popover>

        <ToolbarButton
          editor={editor}
          type="chatComment"
          data-testid="toolbar-comment"
          onClick={() => createComment(editor)}
          tooltip="Comment (⌘+⌥+M)">
          <Icons.comment size={ICON_SIZE} />
        </ToolbarButton>

        <ToolbarButton
          editor={editor}
          type="hyperlink"
          data-testid="toolbar-hyperlink"
          onClick={() => editor.chain().focus().setHyperlink().run()}
          tooltip="Hyperlink (⌘+K)">
          <Icons.link size={ICON_SIZE} />
        </ToolbarButton>

        {/* Lists dropdown */}

        <ToolbarDivider />

        <ToolbarSelect
          editor={editor}
          fallbackIcon={Icons.bulletList}
          tooltip="Lists"
          items={[
            {
              value: 'bulletList',
              label: 'Bullet List',
              icon: Icons.bulletList,
              action: () => editor.chain().focus().toggleBulletList().run()
            },
            {
              value: 'orderedList',
              label: 'Ordered List',
              icon: Icons.orderedList,
              action: () => editor.chain().focus().toggleOrderedList().run()
            },
            {
              value: 'taskList',
              label: 'Task List',
              icon: Icons.taskList,
              action: () => editor.chain().focus().toggleTaskList().run()
            }
          ]}
        />

        {/* Blockquote */}

        <ToolbarButton
          editor={editor}
          type="blockquote"
          data-testid="toolbar-blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          tooltip="Blockquote">
          <Icons.blockquote size={ICON_SIZE} />
        </ToolbarButton>

        {/* Code dropdown */}

        <ToolbarSelect
          editor={editor}
          fallbackIcon={Icons.code}
          tooltip="Code"
          items={[
            {
              value: 'codeBlock',
              label: 'Code Block',
              icon: Icons.codeBlock,
              action: () => editor.chain().focus().toggleCodeBlock().run()
            },
            {
              value: 'inlineCode',
              label: 'Inline Code',
              icon: Icons.code,
              action: () => editor.chain().focus().toggleInlineCode().run()
            }
          ]}
        />

        <ToolbarDivider />

        <ToolbarButton
          data-testid="toolbar-clear-formatting"
          onMouseDown={(event) => {
            event.preventDefault()
            const selection = editor.state.selection
            clearFormattingSelectionRef.current = {
              from: selection.from,
              to: selection.to,
              empty: selection.empty
            }
          }}
          onClick={() => {
            const preserved = clearFormattingSelectionRef.current
            clearFormattingSelectionRef.current = null

            if (preserved && !preserved.empty && preserved.from < preserved.to) {
              editor
                .chain()
                .focus()
                .setTextSelection({ from: preserved.from, to: preserved.to })
                .unsetAllMarks()
                .run()
              return
            }

            clearFormatting(editor)
          }}
          tooltip="Clear Formatting">
          <Icons.clearFormatting size={ICON_SIZE} />
        </ToolbarButton>

        {/* Right-side actions */}

        <div className="!ml-auto flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => window.open('https://discord.gg/25JPG38J59', '_blank')}
            tooltip="Join Discord Community">
            <Icons.discord size={ICON_SIZE} className="text-[#5865F2]" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={copyDocumentToClipboard}
            tooltip={copied ? 'Copied!' : 'Copy Document'}>
            {copied ? (
              <Icons.check size={ICON_SIZE} className="text-success" />
            ) : (
              <Icons.copy size={ICON_SIZE} />
            )}
          </ToolbarButton>

          <ToolbarButton onClick={() => window.print()} tooltip="Print (⌘+P)">
            <Icons.print size={ICON_SIZE} />
          </ToolbarButton>

          {isAuthServiceAvailable && user && (
            <ToolbarButton onClick={() => setDocumentsOpen(true)} tooltip="Documents">
              <Icons.documents size={ICON_SIZE} />
            </ToolbarButton>
          )}

          {user && <ToolbarDivider />}

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <ToolbarButton tooltip="Bookmarks">
                  <Icons.bookmark size={ICON_SIZE} />
                </ToolbarButton>
              </div>
            </PopoverTrigger>
            <PopoverContent className={PANEL_CLASS}>
              <BookmarkPanel />
            </PopoverContent>
          </Popover>

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <ToolbarButton tooltip="Filter Document">
                  <Icons.filter size={ICON_SIZE} />
                </ToolbarButton>
              </div>
            </PopoverTrigger>
            <PopoverContent className={PANEL_CLASS}>
              <FilterPanel />
            </PopoverContent>
          </Popover>

          <ToolbarDivider />

          <Popover placement="bottom-end">
            <PopoverTrigger asChild>
              <div>
                <ToolbarButton tooltip="Document Settings" tooltipPlacement="left">
                  <Icons.settings size={ICON_SIZE} />
                </ToolbarButton>
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
